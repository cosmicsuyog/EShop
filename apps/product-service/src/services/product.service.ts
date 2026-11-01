import prisma from '@packages/libs/prisma/index.js';

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
    select: {
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
    },
  });
