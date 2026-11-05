import prisma from '@packages/libs/prisma/index.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@packages/error-handler/index.js';

const sellerProductSelect = {
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
  isDeleted: true,
  deletedAt: true,
  images: {
    select: {
      url: true,
    },
  },
  createdAt: true,
} as const;

const requiredText = (value: unknown, label: string, maxLength: number) => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new ValidationError(
      `${label} must be a non-empty string of at most ${maxLength} characters.`
    );
  }

  return value.trim();
};

const optionalText = (
  value: unknown,
  label: string,
  maxLength: number
): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new ValidationError(
      `${label} must be a string of at most ${maxLength} characters.`
    );
  }

  return value.trim();
};

const stringList = (
  value: unknown,
  label: string,
  maximumItems: number,
  maximumLength: number
) => {
  const values =
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : value === undefined
      ? []
      : value;

  if (
    !Array.isArray(values) ||
    values.length > maximumItems ||
    !values.every(
      (item) =>
        typeof item === 'string' &&
        item.trim().length > 0 &&
        item.trim().length <= maximumLength
    )
  ) {
    throw new ValidationError(
      `${label} must contain at most ${maximumItems} strings, each no longer than ${maximumLength} characters.`
    );
  }

  return values.map((item) => item.trim());
};

const nonNegativeNumber = (value: unknown, label: string) => {
  if (typeof value === 'string' && value.trim().length === 0) {
    throw new ValidationError(`${label} must be a non-negative number.`);
  }
  const parsed =
    typeof value === 'number' || typeof value === 'string'
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`${label} must be a non-negative number.`);
  }
  return parsed;
};

const nonNegativeInteger = (value: unknown, label: string) => {
  const parsed = nonNegativeNumber(value, label);
  if (!Number.isSafeInteger(parsed) || parsed > 2_147_483_647) {
    throw new ValidationError(`${label} must be a non-negative integer.`);
  }
  return parsed;
};

const getProductInput = (body: unknown) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Product details are required.');
  }

  const input = body as Record<string, unknown>;
  const slug = requiredText(input.slug, 'Slug', 200);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ValidationError(
      'Slug must contain lowercase letters, numbers, and single hyphens.'
    );
  }

  const videoUrl = optionalText(input.video_url, 'Video URL', 2048);
  const brand = optionalText(input.brand, 'Brand', 100);
  const warranty = optionalText(input.warranty, 'Warranty', 500);
  const cashOnDelivery = optionalText(
    input.cash_on_delivery,
    'Cash on delivery',
    100
  );

  return {
    title: requiredText(input.title, 'Title', 200),
    slug,
    short_description: requiredText(
      input.short_description,
      'Short description',
      500
    ),
    detailed_description: requiredText(
      input.detailed_description,
      'Detailed description',
      10_000
    ),
    category: requiredText(input.category, 'Category', 100),
    subcategory: requiredText(input.subcategory, 'Subcategory', 100),
    tags: stringList(input.tags, 'Tags', 50, 100),
    colors: stringList(input.colors, 'Colors', 50, 100),
    sizes: stringList(input.sizes, 'Sizes', 50, 100),
    stock: nonNegativeInteger(input.stock, 'Stock'),
    sale_price: nonNegativeNumber(input.sale_price, 'Sale price'),
    regular_price: nonNegativeNumber(input.regular_price, 'Regular price'),
    ...(videoUrl ? { video_url: videoUrl } : {}),
    ...(brand ? { brand } : {}),
    ...(warranty ? { warranty } : {}),
    ...(cashOnDelivery ? { cashOnDelivery } : {}),
  };
};

const getOwnedShopId = async (sellerId: string) => {
  const shop = await prisma.shops.findUnique({
    where: { sellerId },
    select: { id: true },
  });

  if (!shop) {
    throw new ConflictError('Create your shop before managing products.');
  }

  return shop.id;
};

const getProductId = (value: string) => {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw new ValidationError('Product ID is invalid.');
  }
  return value;
};

const throwProductStateError = (
  product: { isDeleted: boolean } | null,
  deletedState: boolean
) => {
  if (!product) {
    throw new NotFoundError('Product not found.');
  }
  throw new ConflictError(
    deletedState ? 'Product is already deleted.' : 'Product is not deleted.'
  );
};

const getUpdatedProduct = async (id: string, shopId: string) => {
  const product = await prisma.products.findFirst({
    where: { id, shopId },
    select: sellerProductSelect,
  });
  if (!product) {
    throw new NotFoundError('Product not found.');
  }
  return product;
};

const isUniqueConstraintError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
  );

export const createSellerProduct = async (sellerId: string, body: unknown) => {
  const input = getProductInput(body);
  const shopId = await getOwnedShopId(sellerId);
  const existingProduct = await prisma.products.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });

  if (existingProduct) {
    throw new ConflictError('Slug already exists.');
  }

  try {
    return await prisma.products.create({
      data: {
        ...input,
        shopId,
      },
      select: sellerProductSelect,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('Slug already exists.');
    }
    throw error;
  }
};

export const listSellerProducts = async (sellerId: string) => {
  const shopId = await getOwnedShopId(sellerId);
  return prisma.products.findMany({
    where: { shopId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: sellerProductSelect,
  });
};

export const softDeleteSellerProduct = async (
  sellerId: string,
  productId: string
) => {
  const id = getProductId(productId);
  const shopId = await getOwnedShopId(sellerId);
  const updated = await prisma.products.updateMany({
    where: { id, shopId, isDeleted: false },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    const product = await prisma.products.findFirst({
      where: { id, shopId },
      select: { isDeleted: true },
    });
    throwProductStateError(product, true);
  }

  return getUpdatedProduct(id, shopId);
};

export const restoreSellerProduct = async (
  sellerId: string,
  productId: string
) => {
  const id = getProductId(productId);
  const shopId = await getOwnedShopId(sellerId);
  const updated = await prisma.products.updateMany({
    where: { id, shopId, isDeleted: true },
    data: {
      isDeleted: false,
      deletedAt: null,
    },
  });

  if (updated.count !== 1) {
    const product = await prisma.products.findFirst({
      where: { id, shopId },
      select: { isDeleted: true },
    });
    throwProductStateError(product, false);
  }

  return getUpdatedProduct(id, shopId);
};
