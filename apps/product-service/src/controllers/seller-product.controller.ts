import type { NextFunction, Request, Response } from 'express';
import { AuthError } from '@packages/error-handler/index.js';
import {
  createSellerProduct as createProduct,
  listSellerProducts,
  restoreSellerProduct as restoreProduct,
  softDeleteSellerProduct,
} from '../services/seller-product.service.js';

const getSellerId = (req: Request) => {
  const sellerId = req.authenticatedSeller?.id;
  if (!sellerId) {
    throw new AuthError('Seller authentication is required.');
  }
  return sellerId;
};

export const createSellerProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await createProduct(getSellerId(req), req.body);
    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      product,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSellerProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const products = await listSellerProducts(getSellerId(req));
    return res.status(200).json({
      success: true,
      message: 'Products fetched successfully.',
      products,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteSellerProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await softDeleteSellerProduct(
      getSellerId(req),
      req.params.productId
    );
    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully.',
      product,
    });
  } catch (error) {
    return next(error);
  }
};

export const restoreSellerProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await restoreProduct(
      getSellerId(req),
      req.params.productId
    );
    return res.status(200).json({
      success: true,
      message: 'Product restored successfully.',
      product,
    });
  } catch (error) {
    return next(error);
  }
};
