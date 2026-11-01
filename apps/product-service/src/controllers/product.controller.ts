import type { NextFunction, Request, Response } from 'express';
import {
  NotFoundError,
  ValidationError,
} from '@packages/error-handler/index.js';
import {
  getCatalogProductBySlug,
  listCatalogProducts,
} from '../services/product.service.js';

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

export const getCatalogProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { slug } = req.params;

  if (
    slug.trim().length === 0 ||
    slug.length > 200 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    return next(
      new ValidationError(
        'Product slug must contain lowercase letters, numbers, and single hyphens.'
      )
    );
  }

  try {
    const product = await getCatalogProductBySlug(slug);

    if (!product) {
      return next(new NotFoundError('Product not found.'));
    }

    return res.status(200).json({
      success: true,
      message: 'Product fetched successfully!',
      product,
    });
  } catch (error) {
    return next(error);
  }
};
