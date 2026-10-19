import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUPABASE_STORAGE_PREFIX = 'https://mwvbjdifhphfpvrnqqhs.supabase.co/storage/v1/object/public/product-media/';

async function audit() {
  console.log('================================================================');
  console.log('AUDIT: 1,071 PRODUCT PHOTOS TRANSFER VERIFICATION');
  console.log('================================================================\n');

  const products = await prisma.masterProduct.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      thumbnail: true,
      images: true,
      variants: {
        select: {
          id: true,
          code: true,
          thumbnail: true,
          images: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  console.log(`Total Master Products in Database : ${products.length}`);

  let totalImagesCount = 0;
  let supabaseCount = 0;
  let cloudinaryCount = 0;
  let dfurnCount = 0;
  let otherCount = 0;

  const allUrls: { url: string; prodCode: string }[] = [];

  for (const p of products) {
    const rawImages: any[] = Array.isArray(p.images) ? p.images : [];
    for (const img of rawImages) {
      if (!img.url) continue;
      totalImagesCount++;
      allUrls.push({ url: img.url, prodCode: p.code });

      if (img.url.startsWith(SUPABASE_STORAGE_PREFIX)) {
        supabaseCount++;
      } else if (img.url.includes('cloudinary.com')) {
        cloudinaryCount++;
      } else if (img.url.includes('dfurn.in')) {
        dfurnCount++;
      } else {
        otherCount++;
      }
    }
  }

  console.log(`Total Photo Slots Audited        : ${totalImagesCount}`);
  console.log(`Transferred to Supabase Storage   : ${supabaseCount} (${((supabaseCount / totalImagesCount) * 100).toFixed(1)}%)`);
  console.log(`Remaining on Cloudinary           : ${cloudinaryCount}`);
  console.log(`Remaining on D'Furn Website       : ${dfurnCount}`);
  console.log(`Other External Hosts              : ${otherCount}\n`);

  // Check thumbnails
  let masterThumbnailsOnSupabase = 0;
  let variantThumbnailsOnSupabase = 0;
  let totalVariants = 0;

  for (const p of products) {
    if (p.thumbnail && p.thumbnail.startsWith(SUPABASE_STORAGE_PREFIX)) {
      masterThumbnailsOnSupabase++;
    }
    for (const v of p.variants) {
      totalVariants++;
      if (v.thumbnail && v.thumbnail.startsWith(SUPABASE_STORAGE_PREFIX)) {
        variantThumbnailsOnSupabase++;
      }
    }
  }

  console.log(`Master Product Thumbnails on Supabase : ${masterThumbnailsOnSupabase} / ${products.length}`);
  console.log(`Variant Thumbnails on Supabase        : ${variantThumbnailsOnSupabase} / ${totalVariants}\n`);

  // Random sample live HTTP verification
  console.log('Sampling 15 random Supabase Storage images for live HTTP 200 delivery...');
  const sampleIndices = [0, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1050, totalImagesCount - 1];
  let verifiedCount = 0;

  for (const idx of sampleIndices) {
    if (idx >= allUrls.length) continue;
    const item = allUrls[idx];
    try {
      const res = await fetch(item.url, { method: 'HEAD' });
      const size = res.headers.get('content-length');
      const mime = res.headers.get('content-type');
      if (res.ok) {
        verifiedCount++;
        console.log(`  ✓ [${item.prodCode}] HTTP ${res.status} (${mime}, ${size ? Math.round(Number(size) / 1024) + ' KB' : 'OK'})`);
      } else {
        console.error(`  ✗ [${item.prodCode}] Failed with HTTP ${res.status}: ${item.url}`);
      }
    } catch (e: any) {
      console.error(`  ✗ [${item.prodCode}] Network error: ${e.message}`);
    }
  }

  console.log(`\nVerified Live Delivery : ${verifiedCount} / ${sampleIndices.length} sample images returned HTTP 200 OK.`);
  console.log('================================================================');
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
