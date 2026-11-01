import prisma from '@packages/libs/prisma/index.js';
import {
  NotFoundError,
  ValidationError,
} from '@packages/error-handler/index.js';

const productSelect = {
  id: true,
  title: true,
  slug: true,
  stock: true,
  sale_price: true,
  status: true,
  isDeleted: true,
  images: {
    select: {
      url: true,
    },
  },
} as const;

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

const ensureCart = (userId: string) =>
  prisma.carts.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });

const getAvailableProduct = async (productId: string) => {
  const product = await prisma.products.findUnique({
    where: { id: productId },
    select: productSelect,
  });

  if (!product || product.isDeleted || product.status !== 'Active') {
    throw new NotFoundError('Product is unavailable.');
  }
  if (product.stock < 1) {
    throw new ValidationError('Product is out of stock.');
  }

  return product;
};

const serializeCart = async (cartId: string) => {
  const items = await prisma.cartItems.findMany({
    where: { cartId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      productId: true,
      quantity: true,
    },
  });

  const productIds = [...new Set(items.map(({ productId }) => productId))];
  const products =
    productIds.length > 0
      ? await prisma.products.findMany({
          where: { id: { in: productIds } },
          select: productSelect,
        })
      : [];
  const productsById = new Map(
    products.map((product) => [product.id, product])
  );

  const serializedItems = items.map((item) => {
    const product = productsById.get(item.productId);
    const available = Boolean(
      product &&
        !product.isDeleted &&
        product.status === 'Active' &&
        product.stock > 0
    );
    const lineSubtotal = product ? product.sale_price * item.quantity : 0;

    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      available,
      product: product
        ? {
            id: product.id,
            title: product.title,
            slug: product.slug,
            salePrice: product.sale_price,
            stock: product.stock,
            images: product.images.filter(({ url }) => isPublicImageUrl(url)),
          }
        : null,
      lineSubtotal,
    };
  });

  return {
    items: serializedItems,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: serializedItems.reduce(
      (total, item) => (item.available ? total + item.lineSubtotal : total),
      0
    ),
  };
};

const getCartForUser = async (userId: string) => {
  const cart = await ensureCart(userId);
  return {
    id: cart.id,
    ...(await serializeCart(cart.id)),
  };
};

export const getCustomerCart = getCartForUser;

export const addCartItem = async (
  userId: string,
  productId: string,
  quantity: number
) => {
  const product = await getAvailableProduct(productId);
  const cart = await ensureCart(userId);
  const uniqueKey = {
    cartId_productId: {
      cartId: cart.id,
      productId,
    },
  };
  const existingItem = await prisma.cartItems.findUnique({
    where: uniqueKey,
    select: { quantity: true },
  });

  if ((existingItem?.quantity ?? 0) + quantity > product.stock) {
    throw new ValidationError('Requested quantity exceeds available stock.');
  }

  const item = await prisma.cartItems.upsert({
    where: uniqueKey,
    update: { quantity: { increment: quantity } },
    create: { cartId: cart.id, productId, quantity },
    select: { quantity: true },
  });

  if (item.quantity > product.stock) {
    await prisma.cartItems.update({
      where: uniqueKey,
      data: { quantity: { decrement: quantity } },
    });
    throw new ValidationError('Requested quantity exceeds available stock.');
  }

  return getCartForUser(userId);
};

export const updateCartItemQuantity = async (
  userId: string,
  productId: string,
  quantity: number
) => {
  const product = await getAvailableProduct(productId);
  if (quantity > product.stock) {
    throw new ValidationError('Requested quantity exceeds available stock.');
  }

  const cart = await ensureCart(userId);
  const result = await prisma.cartItems.updateMany({
    where: { cartId: cart.id, productId },
    data: { quantity },
  });

  if (result.count === 0) {
    throw new NotFoundError('Cart item not found.');
  }

  return getCartForUser(userId);
};

export const removeCartItem = async (userId: string, productId: string) => {
  const cart = await ensureCart(userId);
  const result = await prisma.cartItems.deleteMany({
    where: { cartId: cart.id, productId },
  });

  if (result.count === 0) {
    throw new NotFoundError('Cart item not found.');
  }

  return getCartForUser(userId);
};

export const clearCustomerCart = async (userId: string) => {
  const cart = await ensureCart(userId);
  await prisma.cartItems.deleteMany({
    where: { cartId: cart.id },
  });

  return getCartForUser(userId);
};
