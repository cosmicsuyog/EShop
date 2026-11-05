import prisma from '@packages/libs/prisma/index.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@packages/error-handler/index.js';

export interface DiscountCodeInput {
  public_name: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountCode: string;
}

const requiredString = (value: unknown, label: string, maxLength: number): string => {
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

const validateDiscountInput = (body: unknown): DiscountCodeInput => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Discount code details are required.');
  }

  const input = body as Record<string, unknown>;
  const public_name = requiredString(input.public_name, 'Title', 100);

  const rawType = typeof input.discountType === 'string' ? input.discountType.toLowerCase().trim() : '';
  if (rawType !== 'percentage' && rawType !== 'flat') {
    throw new ValidationError("Discount type must be either 'percentage' or 'flat'.");
  }
  const discountType: 'percentage' | 'flat' = rawType;

  const rawValue =
    typeof input.discountValue === 'number'
      ? input.discountValue
      : typeof input.discountValue === 'string' && input.discountValue.trim().length > 0
      ? Number(input.discountValue)
      : Number.NaN;

  if (!Number.isFinite(rawValue) || rawValue < 1) {
    throw new ValidationError('Discount value must be at least 1.');
  }

  if (discountType === 'percentage' && (rawValue < 1 || rawValue > 100)) {
    throw new ValidationError('Percentage discount value must be between 1 and 100.');
  }

  const rawCode = requiredString(input.discountCode, 'Discount code', 30);
  const normalizedCode = rawCode.toUpperCase();
  if (!/^[A-Z0-9_-]{2,30}$/.test(normalizedCode)) {
    throw new ValidationError(
      'Discount code must be 2 to 30 characters consisting of letters, numbers, hyphens, and underscores.'
    );
  }

  return {
    public_name,
    discountType,
    discountValue: Math.round(rawValue * 100) / 100,
    discountCode: normalizedCode,
  };
};

const getOwnedShopId = async (sellerId: string) => {
  const shop = await prisma.shops.findUnique({
    where: { sellerId },
    select: { id: true },
  });

  if (!shop) {
    throw new ConflictError('Create your shop before managing discount codes.');
  }

  return shop.id;
};

const validateObjectId = (id: string, label = 'Discount code ID') => {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new ValidationError(`${label} is invalid.`);
  }
  return id;
};

export const createSellerDiscountCode = async (sellerId: string, body: unknown) => {
  await getOwnedShopId(sellerId);
  const input = validateDiscountInput(body);

  const existingCount = await prisma.discount_codes.count({
    where: { sellerId },
  });

  if (existingCount >= 8) {
    throw new ConflictError('You can only create up to 8 discount codes.');
  }

  const existingCode = await prisma.discount_codes.findUnique({
    where: { discountCode: input.discountCode },
    select: { id: true },
  });

  if (existingCode) {
    throw new ConflictError(
      'Discount code already exists! Please use a different discount code.'
    );
  }

  try {
    return await prisma.discount_codes.create({
      data: {
        ...input,
        sellerId,
      },
      select: {
        id: true,
        public_name: true,
        discountType: true,
        discountValue: true,
        discountCode: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictError(
        'Discount code already exists! Please use a different discount code.'
      );
    }
    throw error;
  }
};

export const listSellerDiscountCodes = async (sellerId: string) => {
  await getOwnedShopId(sellerId);

  return prisma.discount_codes.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      public_name: true,
      discountType: true,
      discountValue: true,
      discountCode: true,
      createdAt: true,
    },
  });
};

export const deleteSellerDiscountCode = async (sellerId: string, codeId: string) => {
  await getOwnedShopId(sellerId);
  const id = validateObjectId(codeId);

  const discount = await prisma.discount_codes.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!discount) {
    throw new NotFoundError('Discount code not found!');
  }

  await prisma.discount_codes.delete({
    where: { id: discount.id },
  });

  return { success: true, message: 'Discount code deleted successfully!' };
};
