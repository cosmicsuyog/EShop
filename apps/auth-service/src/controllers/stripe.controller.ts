import type { NextFunction, Request, Response } from 'express';
import { AuthError, ValidationError } from '@packages/error-handler/index.js';
import { stripeService } from '../services/stripe.service';

const getAuthenticatedSellerId = (req: Request): string => {
  const sellerId = req.authenticatedSeller?.id;
  if (!sellerId) {
    throw new AuthError('Seller authentication is required.');
  }

  // If a sellerId is explicitly provided in body, verify it matches the authenticated seller
  if (req.body?.sellerId && req.body.sellerId !== sellerId) {
    throw new AuthError('Unauthorized: Seller ID mismatch.');
  }

  return sellerId;
};

export const createStripeConnectLink = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getAuthenticatedSellerId(req);
    const { refresh_url, return_url } = req.body || {};

    const { url, data } = await stripeService.createAccountLink(sellerId, {
      refresh_url,
      return_url,
    });

    return res.status(201).json({
      success: true,
      message: 'Stripe connect link created successfully!',
      data,
      url,
    });
  } catch (error) {
    return next(error);
  }
};

export const getStripeAccountStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getAuthenticatedSellerId(req);
    const status = await stripeService.getAccountStatus(sellerId);

    return res.status(200).json({
      success: true,
      message: 'Stripe account status retrieved successfully.',
      ...status,
    });
  } catch (error) {
    return next(error);
  }
};

export const createStripeDashboardLink = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getAuthenticatedSellerId(req);
    const { url } = await stripeService.createDashboardLoginLink(sellerId);

    return res.status(200).json({
      success: true,
      message: 'Dashboard login link created successfully.',
      url,
    });
  } catch (error) {
    return next(error);
  }
};

export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!signature) {
      throw new ValidationError('Missing stripe-signature header.');
    }

    // Support both string, Buffer, or parsed body converted back
    const rawPayload =
      typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body);

    const event = stripeService.verifyWebhookSignature(rawPayload, signature);
    const result = await stripeService.processWebhookEvent(event);

    return res.status(200).json({
      received: true,
      handled: result.handled,
      type: result.eventType,
    });
  } catch (error) {
    return next(error);
  }
};
