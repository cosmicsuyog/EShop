import type { NextFunction, Request, Response } from 'express';
import { AuthError } from '@packages/error-handler/index.js';
import {
  createSellerDiscountCode,
  deleteSellerDiscountCode,
  listSellerDiscountCodes,
} from '../services/seller-discount.service.js';

const getSellerId = (req: Request): string => {
  const sellerId = req.authenticatedSeller?.id;
  if (!sellerId) {
    throw new AuthError('Seller authentication is required.');
  }
  return sellerId;
};

export const createDiscountCodes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const discount_code = await createSellerDiscountCode(
      getSellerId(req),
      req.body
    );

    return res.status(201).json({
      success: true,
      message: 'Discount code created successfully!',
      discount_code,
    });
  } catch (error) {
    return next(error);
  }
};

export const getDiscountCodes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const discount_codes = await listSellerDiscountCodes(getSellerId(req));

    return res.status(200).json({
      success: true,
      message: 'Discount codes fetched successfully!',
      discount_codes,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteDiscountCodes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await deleteSellerDiscountCode(getSellerId(req), req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Discount code deleted successfully!',
    });
  } catch (error) {
    return next(error);
  }
};
