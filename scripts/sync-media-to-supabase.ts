import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mwvbjdifhphfpvrnqqhs.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'product-media';
const CONCURRENCY = 10;

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required in .env');
  process.exit(1);
}

// Map remoteUrl -> supabasePublicUrl
const urlCache = new Map<string, string>();

async function uploadToSupabase(storagePath: string, buffer: Buffer, contentType: string, retries = 2): Promise<string> {
  const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${storagePath}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(buffer),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Upload HTTP ${res.status}: ${txt}`);
      }

      return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error(`Upload failed after ${retries} attempts`);
}

async function mirrorUrl(remoteUrl: string, folderCode: string, filePrefix: string): Promise<string> {
  if (!remoteUrl || typeof remoteUrl !== 'string') return remoteUrl;
  
  // If already hosted on our Supabase bucket, return as is
  if (remoteUrl.includes(SUPABASE_URL) && remoteUrl.includes(`/${BUCKET_NAME}/`)) {
    return remoteUrl;
  }

  // Check cache
  if (urlCache.has(remoteUrl)) {
    return urlCache.get(remoteUrl)!;
  }

  // Fetch remote image
  const imgRes = await fetch(remoteUrl);
  if (!imgRes.ok) {
    throw new Error(`Fetch failed: HTTP ${imgRes.status}`);
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const safeFilename = `${filePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const storagePath = `${folderCode}/${safeFilename}`;

  const publicUrl = await uploadToSupabase(storagePath, buffer, contentType);
  urlCache.set(remoteUrl, publicUrl);
  return publicUrl;
}

// Concurrency pool runner
async function runPool<T>(items: T[], fn: (item: T, idx: number) => Promise<void>, concurrency: number) {
  let index = 0;
  const workers = Array(concurrency).fill(null).map(async () => {
    while (index < items.length) {
      const curr = index++;
      await fn(items[curr], curr);
    }
  });
  await Promise.all(workers);
}

async function main() {
  console.log('================================================================');
  console.log('SUPABASE PRODUCT MEDIA MIRRORING PIPELINE (HIGH-THROUGHPUT)');
  console.log('================================================================');
  console.log(`Target Bucket : ${BUCKET_NAME}`);
  console.log(`Supabase Host : ${SUPABASE_URL}`);
  console.log(`Concurrency   : ${CONCURRENCY} parallel streams\n`);

  const startTime = Date.now();

  const products = await prisma.masterProduct.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      thumbnail: true,
      images: true,
    },
    orderBy: { code: 'asc' },
  });

  console.log(`Found ${products.length} master products to mirror.`);

  let totalImagesProcessed = 0;
  let totalUploaded = 0;
  let failedImages = 0;
  let productsUpdated = 0;

  // Process products with concurrency
  await runPool(products, async (prod, pIdx) => {
    const rawImages: any[] = Array.isArray(prod.images) ? prod.images : [];
    let prodUpdated = false;
    const newImages = [];

    for (let i = 0; i < rawImages.length; i++) {
      const img = rawImages[i];
      totalImagesProcessed++;

      if (!img.url || typeof img.url !== 'string') {
        newImages.push(img);
        continue;
      }

      try {
        const publicUrl = await mirrorUrl(img.url, prod.code, `photo_${i + 1}`);
        if (publicUrl !== img.url) {
          prodUpdated = true;
          totalUploaded++;
        }
        newImages.push({
          ...img,
          url: publicUrl,
        });
      } catch (err: any) {
        failedImages++;
        console.error(`  [${prod.code}] Failed photo ${i + 1}: ${err.message}`);
        newImages.push(img);
      }
    }

    let newThumbnail = prod.thumbnail;
    if (prod.thumbnail && !prod.thumbnail.includes(SUPABASE_URL)) {
      try {
        newThumbnail = await mirrorUrl(prod.thumbnail, prod.code, 'thumb');
        if (newThumbnail !== prod.thumbnail) {
          prodUpdated = true;
        }
      } catch (err: any) {
        // Fallback to first mirrored image if available
        newThumbnail = newImages[0]?.url || prod.thumbnail;
      }
    } else if (!newThumbnail && newImages.length > 0) {
      newThumbnail = newImages[0]?.url;
      prodUpdated = true;
    }

    if (prodUpdated) {
      await prisma.masterProduct.update({
        where: { id: prod.id },
        data: {
          images: newImages,
          thumbnail: newThumbnail,
        },
      });

      await prisma.variant.updateMany({
        where: { masterProductId: prod.id },
        data: {
          images: newImages,
          thumbnail: newThumbnail,
        },
      });

      productsUpdated++;
    }

    if ((pIdx + 1) % 20 === 0 || pIdx + 1 === products.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  [Progress] ${pIdx + 1}/${products.length} products processed (${totalUploaded} images uploaded to Supabase, ${elapsed}s elapsed)`);
    }
  }, CONCURRENCY);

  // Also mirror any CatalogueEntry swatches
  console.log('\nChecking Standard Catalogue swatches...');
  const swatches = await prisma.catalogueEntry.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, code: true, imageUrl: true },
  });

  let swatchesUpdated = 0;
  for (const sw of swatches) {
    if (sw.imageUrl && !sw.imageUrl.includes(SUPABASE_URL)) {
      try {
        const publicUrl = await mirrorUrl(sw.imageUrl, 'swatches', sw.code || 'swatch');
        await prisma.catalogueEntry.update({
          where: { id: sw.id },
          data: { imageUrl: publicUrl },
        });
        swatchesUpdated++;
      } catch (err: any) {
        console.warn(`  Swatch ${sw.code} mirror note:`, err.message);
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n================================================================');
  console.log('SUPABASE MIRRORING COMPLETE');
  console.log('================================================================');
  console.log(`Total Products Updated : ${productsUpdated} / ${products.length}`);
  console.log(`Total Images Uploaded  : ${totalUploaded}`);
  console.log(`Swatches Updated       : ${swatchesUpdated}`);
  console.log(`Failed Images          : ${failedImages}`);
  console.log(`Total Duration         : ${totalTime}s`);
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('Fatal pipeline error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
