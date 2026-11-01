import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@packages/error-handler/index.js';
import { listCatalogProducts } from '../services/product.service.js';

export const getCatalogProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const category = req.query.category;

    if (
      category !== undefined &&
      (typeof category !== 'string' ||
        category.trim().length === 0 ||
        category.length > 100)
    ) {
      return next(
        new ValidationError(
          'Category must be a non-empty string of at most 100 characters.'
        )
      );
    }

    const products = await listCatalogProducts(
      typeof category === 'string' ? category.trim() : undefined
    );

    return res.status(200).json({
      success: true,
      message: 'Products fetched successfully!',
      products,
    });
  } catch (error) {
    return next(error);
  }
};
