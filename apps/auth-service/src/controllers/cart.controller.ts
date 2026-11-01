import type { NextFunction, Request, Response } from 'express';
import { AuthError, ValidationError } from '@packages/error-handler/index.js';
import {
  addCartItem,
  clearCustomerCart,
  getCustomerCart,
  removeCartItem,
  updateCartItemQuantity,
} from '../services/cart.service';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const getAuthenticatedUserId = (req: Request) => {
  if (!req.authenticatedUser) {
    throw new AuthError('Access token is required.');
  }
  return req.authenticatedUser.id;
};

const parseProductId = (value: unknown) => {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw new ValidationError('Product ID must be a valid MongoDB ObjectId.');
  }
  return value;
};

const parseQuantity = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ValidationError('Quantity must be a positive whole number.');
  }
  return value;
};

export const getCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const cart = await getCustomerCart(getAuthenticatedUserId(req));
    return res.status(200).json({
      success: true,
      message: 'Cart fetched successfully.',
      cart,
    });
  } catch (error) {
    return next(error);
  }
};

export const addItemToCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const productId = parseProductId(req.body?.productId);
    const quantity =
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'quantity')
        ? parseQuantity(req.body.quantity)
        : 1;
    const cart = await addCartItem(userId, productId, quantity);

    return res.status(200).json({
      success: true,
      message: 'Product added to cart.',
      cart,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateCartItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const productId = parseProductId(req.params.productId);
    const quantity = parseQuantity(req.body?.quantity);
    const cart = await updateCartItemQuantity(userId, productId, quantity);

    return res.status(200).json({
      success: true,
      message: 'Cart item quantity updated.',
      cart,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeItemFromCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const productId = parseProductId(req.params.productId);
    const cart = await removeCartItem(userId, productId);

    return res.status(200).json({
      success: true,
      message: 'Cart item removed.',
      cart,
    });
  } catch (error) {
    return next(error);
  }
};

export const clearCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const cart = await clearCustomerCart(getAuthenticatedUserId(req));
    return res.status(200).json({
      success: true,
      message: 'Cart cleared.',
      cart,
    });
  } catch (error) {
    return next(error);
  }
};
