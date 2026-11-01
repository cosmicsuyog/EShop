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
  images: {
    select: {
      url: true,
    },
  },
  createdAt: true,
} as const;

const catalogProductDetailSelect = {
  ...catalogProductSelect,
  id: false,
} as const;

export const listCatalogProducts = (
  category: string | undefined,
  subcategory: string | undefined,
  page: number,
  limit: number
) => {
  const where = {
    isDeleted: false,
    status: 'Active' as const,
    ...(category ? { category } : {}),
    ...(subcategory ? { subcategory } : {}),
  };

  return Promise.all([
    prisma.products.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: catalogProductSelect,
    }),
    prisma.products.count({ where }),
  ]);
};

export const listCatalogCategories = () =>
  prisma.products.findMany({
    where: {
      isDeleted: false,
      status: 'Active',
    },
    distinct: ['category'],
    orderBy: {
      category: 'asc',
    },
    select: {
      category: true,
    },
  });

export const listCatalogSubcategories = (category: string) =>
  prisma.products.findMany({
    where: {
      isDeleted: false,
      status: 'Active',
      category,
    },
    distinct: ['subcategory'],
    orderBy: {
      subcategory: 'asc',
    },
    select: {
      subcategory: true,
    },
  });

const isPublicImageUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
};

export const toCatalogProductResponse = <
  T extends { images: { url: string }[] }
>(
  product: T
) => ({
  ...product,
  images: product.images
    .filter(({ url }) => isPublicImageUrl(url))
    .map(({ url }) => ({ url })),
});

export const getCatalogProductBySlug = (slug: string) =>
  prisma.products.findFirst({
    where: {
      slug,
      isDeleted: false,
      status: 'Active',
    },
    select: catalogProductDetailSelect,
  });
