import type { NextFunction, Request, Response } from 'express';
import { AuthError } from '@packages/error-handler/index.js';
import {
  deleteSellerProductImage as deleteProductImage,
  uploadSellerProductImage as uploadProductImage,
} from '../services/product-image.service.js';

const getSellerId = (req: Request) => {
  const sellerId = req.authenticatedSeller?.id;
  if (!sellerId) {
    throw new AuthError('Seller authentication is required.');
  }
  return sellerId;
};

export const uploadSellerProductImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const image = await uploadProductImage(getSellerId(req), req.body?.fileName);
    return res.status(201).json({
      success: true,
      message: 'Product image uploaded successfully.',
      ...image,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteSellerProductImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await deleteProductImage(getSellerId(req), req.body?.fileId);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};
