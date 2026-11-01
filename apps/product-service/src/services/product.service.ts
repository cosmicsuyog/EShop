import prisma from '@packages/libs/prisma/index.js';

const catalogProductSelect = {
  id: true,
  title: true,
  slug: true,
  category: true,
  subcategory: true,
  short_description: true,
  detailed_description: true,
  video_url: true,
  tags: true,
  brand: true,
  colors: true,
  sizes: true,
  stock: true,
  sale_price: true,
  regular_price: true,
  rattings: true,
  warranty: true,
  createdAt: true,
} as const;

export const listCatalogProducts = (category?: string) =>
  prisma.products.findMany({
    where: {
      isDeleted: false,
      status: 'Active',
      ...(category ? { category } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: catalogProductSelect,
  });

export const getCatalogProductBySlug = (slug: string) =>
  prisma.products.findFirst({
    where: {
      slug,
      isDeleted: false,
      status: 'Active',
    },
    select: catalogProductSelect,
  });
