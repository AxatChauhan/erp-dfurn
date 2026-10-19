import { Suspense } from 'react';
import { connection } from 'next/server';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import ProductsClient from './ProductsClient';
import ProductsLoading from './loading';
import { computeCbm, dimensionsInInches } from '@/lib/products/measures';
import { processStatusOf, bomStatusOf, packingStatusOf, toSlimListRow } from '@/lib/products/status';

export const getCachedProductsData = unstable_cache(
  async () => {
    const [productsRaw, segments, departments, catalogues] = await Promise.all([
      prisma.masterProduct.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          name: true,
          categoryId: true,
          subCategoryId: true,
          thumbnail: true,
          images: true,
          baseSellingRate: true,
          departmentIds: true,
          defaultDeliveryMode: true,
          defaultCreationMode: true,
          unitOfMeasurement: true,
          grossMarginTargetPct: true,
          leadTimeDays: true,
          moq: true,
          nakedDimensions: true,
          boxDimensions: true,
          processChart: true,
          bom: true,
          packingList: true,
          createdAt: true,
          category: {
            select: { id: true, name: true, code: true, segmentId: true },
          },
          subCategory: {
            select: { id: true, name: true, code: true },
          },
          variants: {
            select: {
              id: true,
              code: true,
              name: true,
              baseSellingRate: true,
              thumbnail: true,
              departmentIds: true,
              processChart: true,
              bom: true,
              packingList: true,
            },
            orderBy: { code: 'asc' },
          },
        },
      }),
      prisma.segment.findMany({
        orderBy: { name: 'asc' },
        include: {
          categories: {
            orderBy: { name: 'asc' },
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.department.findMany({
        where: { isProduction: true },
        select: { id: true, name: true, isProduction: true },
        orderBy: { name: 'asc' },
      }),
      prisma.standardCatalogue.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    const initialProducts = productsRaw.map((p) => {
      const naked = p.nakedDimensions as any;
      const box = p.boxDimensions as any;
      const cbm = computeCbm(box);
      const inches = dimensionsInInches(naked);

      const variantCount = p.variants.length;
      const avgSellingPrice = variantCount > 0
        ? Math.round(p.variants.reduce((sum, v) => sum + v.baseSellingRate, 0) / variantCount)
        : null;

      const deptNames = p.departmentIds.map((id) => deptMap.get(id) || id);

      const enrichedVariants = p.variants.map((v) => ({
        id: v.id,
        code: v.code,
        name: v.name,
        baseSellingRate: v.baseSellingRate,
        thumbnail: v.thumbnail,
        processStatus: processStatusOf(v),
        bomStatus: bomStatusOf(v.bom),
        packingStatus: packingStatusOf(v.packingList),
      }));

      return toSlimListRow({
        id: p.id,
        code: p.code,
        name: p.name,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        segmentId: p.category.segmentId,
        subCategoryId: p.subCategoryId,
        subCategoryName: p.subCategory.name,
        departmentIds: p.departmentIds,
        departments: deptNames,
        defaultDeliveryMode: p.defaultDeliveryMode,
        defaultCreationMode: p.defaultCreationMode,
        unitOfMeasurement: p.unitOfMeasurement,
        baseSellingRate: p.baseSellingRate,
        grossMarginTargetPct: p.grossMarginTargetPct,
        leadTimeDays: p.leadTimeDays,
        moq: p.moq,
        thumbnail: p.thumbnail,
        images: p.images,
        cbm,
        nakedDimensions: naked,
        boxDimensions: box,
        nakedDimensionsInches: inches,
        totalVariants: variantCount,
        avgSellingPrice,
        processStatus: processStatusOf(p),
        bomStatus: bomStatusOf(p.bom),
        packingStatus: packingStatusOf(p.packingList),
        variants: enrichedVariants,
        createdAt: p.createdAt,
      });
    });

    return {
      initialProducts,
      segments,
      departments,
      catalogues,
    };
  },
  ['products-catalog-page-v1'],
  {
    tags: ['products-catalog'],
    revalidate: 60,
  }
);

async function ProductsDataLoader() {
  await connection();
  const { initialProducts, segments, departments, catalogues } = await getCachedProductsData();

  return (
    <ProductsClient
      initialProducts={initialProducts}
      segments={segments}
      departments={departments}
      catalogues={catalogues}
    />
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsLoading />}>
      <ProductsDataLoader />
    </Suspense>
  );
}
