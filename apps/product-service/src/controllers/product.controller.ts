import type { NextFunction, Request, Response } from 'express';
import {
  NotFoundError,
  ValidationError,
} from '@packages/error-handler/index.js';
import {
  getCatalogProductBySlug,
  listCatalogCategories,
  listCatalogProducts,
  listCatalogSubcategories,
} from '../services/product.service.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parsePositiveInteger = (value: unknown) => {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

export const getCatalogCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await listCatalogCategories();

    return res.status(200).json({
      success: true,
      message: 'Categories fetched successfully!',
      categories: categories.map(({ category }) => category),
    });
  } catch (error) {
    return next(error);
  }
};

export const getCatalogSubcategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { category } = req.query;

  if (
    typeof category !== 'string' ||
    category.trim().length === 0 ||
    category.length > 100
  ) {
    return next(
      new ValidationError(
        'Category must be a non-empty string of at most 100 characters.'
      )
    );
  }

  try {
    const subcategories = await listCatalogSubcategories(category.trim());

    return res.status(200).json({
      success: true,
      message: 'Subcategories fetched successfully!',
      subcategories: subcategories.map(({ subcategory }) => subcategory),
    });
  } catch (error) {
    return next(error);
  }
};

export const getCatalogProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const category = req.query.category;
    const subcategory = req.query.subcategory;
    const page =
      req.query.page === undefined
        ? DEFAULT_PAGE
        : parsePositiveInteger(req.query.page);
    const limit =
      req.query.limit === undefined
        ? DEFAULT_LIMIT
        : parsePositiveInteger(req.query.limit);

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

    if (
      subcategory !== undefined &&
      (typeof subcategory !== 'string' ||
        subcategory.trim().length === 0 ||
        subcategory.length > 100)
    ) {
      return next(
        new ValidationError(
          'Subcategory must be a non-empty string of at most 100 characters.'
        )
      );
    }

    if (page === undefined || limit === undefined || limit > MAX_LIMIT) {
      return next(
        new ValidationError(
          `Page must be a positive integer and limit must be a positive integer no greater than ${MAX_LIMIT}.`
        )
      );
    }

    if (!Number.isSafeInteger((page - 1) * limit)) {
      return next(
        new ValidationError('The requested page is too large.')
      );
    }

    const [products, total] = await listCatalogProducts(
      typeof category === 'string' ? category.trim() : undefined,
      typeof subcategory === 'string' ? subcategory.trim() : undefined,
      page,
      limit
    );

    return res.status(200).json({
      success: true,
      message: 'Products fetched successfully!',
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
