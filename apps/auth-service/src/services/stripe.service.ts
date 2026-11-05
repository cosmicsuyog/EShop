import crypto from 'node:crypto';
import axios, { AxiosResponse } from 'axios';
import prisma from '@packages/libs/prisma/index.js';
import {
  AuthError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@packages/error-handler/index.js';

export interface StripeAccountResponse {
  id: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  default_currency?: string;
  email?: string;
  country?: string;
}

export interface StripeAccountLinkResponse {
  object: 'account_link';
  created: number;
  expires_at: number;
  url: string;
}

export interface StripeLoginLinkResponse {
  object: 'login_link';
  created: number;
  url: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export class StripeService {
  private getSecretKey(): string {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.trim() === '') {
      throw new ValidationError(
        'Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in your environment.'
      );
    }
    return key.trim();
  }

  private getWebhookSecret(): string {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || secret.trim() === '') {
      throw new ValidationError(
        'Stripe webhook secret is not configured. Please set STRIPE_WEBHOOK_SECRET in your environment.'
      );
    }
    return secret.trim();
  }

  private getBaseHeaders() {
    return {
      Authorization: `Bearer ${this.getSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  /**
   * Create an Express connected account for a seller if not already created.
   */
  async getOrCreateConnectedAccount(sellerId: string): Promise<{ stripeId: string; created: boolean }> {
    const seller = await prisma.sellers.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        email: true,
        country: true,
        name: true,
        stripeId: true,
      },
    });

    if (!seller) {
      throw new NotFoundError('Seller not found.');
    }

    if (seller.stripeId) {
      return { stripeId: seller.stripeId, created: false };
    }

    const params = new URLSearchParams();
    params.append('type', 'express');
    params.append('email', seller.email);
    // Stripe requires valid 2-letter country code; default to US if not 2 letters
    const country = (seller.country && seller.country.length === 2)
      ? seller.country.toUpperCase()
      : 'US';
    params.append('country', country);
    params.append('capabilities[card_payments][requested]', 'true');
    params.append('capabilities[transfers][requested]', 'true');
    params.append('business_type', 'individual');

    let response: AxiosResponse<StripeAccountResponse>;
    try {
      response = await axios.post<StripeAccountResponse>(
        'https://api.stripe.com/v1/accounts',
        params.toString(),
        { headers: this.getBaseHeaders() }
      );
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Stripe account creation failed.';
      throw new ValidationError(`Stripe error: ${message}`);
    }

    const stripeId = response.data.id;

    await prisma.sellers.update({
      where: { id: sellerId },
      data: { stripeId },
    });

    return { stripeId, created: true };
  }

  /**
   * Generate a Stripe onboarding AccountLink URL.
   */
  async createAccountLink(
    sellerId: string,
    customUrls?: { refresh_url?: string; return_url?: string }
  ): Promise<{ url: string; data: StripeAccountLinkResponse }> {
    const { stripeId } = await this.getOrCreateConnectedAccount(sellerId);

    const defaultRefreshUrl =
      process.env.STRIPE_REFRESH_URL ||
      `${process.env.SELLER_UI_ORIGIN || 'http://localhost:3001'}/dashboard/payments?status=refresh`;
    const defaultReturnUrl =
      process.env.STRIPE_RETURN_URL ||
      `${process.env.SELLER_UI_ORIGIN || 'http://localhost:3001'}/dashboard/payments?status=success`;

    const refreshUrl = customUrls?.refresh_url || defaultRefreshUrl;
    const returnUrl = customUrls?.return_url || defaultReturnUrl;

    const params = new URLSearchParams();
    params.append('account', stripeId);
    params.append('refresh_url', refreshUrl);
    params.append('return_url', returnUrl);
    params.append('type', 'account_onboarding');

    let response: AxiosResponse<StripeAccountLinkResponse>;
    try {
      response = await axios.post<StripeAccountLinkResponse>(
        'https://api.stripe.com/v1/account_links',
        params.toString(),
        { headers: this.getBaseHeaders() }
      );
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Stripe link creation failed.';
      throw new ValidationError(`Stripe error: ${message}`);
    }

    return {
      url: response.data.url,
      data: response.data,
    };
  }

  /**
   * Retrieve the current onboarding and payment status of a seller's connected Stripe account.
   */
  async getAccountStatus(sellerId: string): Promise<{
    connected: boolean;
    stripeId: string | null;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    currency?: string;
  }> {
    const seller = await prisma.sellers.findUnique({
      where: { id: sellerId },
      select: { id: true, stripeId: true },
    });

    if (!seller) {
      throw new NotFoundError('Seller not found.');
    }

    if (!seller.stripeId) {
      return {
        connected: false,
        stripeId: null,
        detailsSubmitted: false,
        payoutsEnabled: false,
        chargesEnabled: false,
      };
    }

    let response: AxiosResponse<StripeAccountResponse>;
    try {
      response = await axios.get<StripeAccountResponse>(
        `https://api.stripe.com/v1/accounts/${seller.stripeId}`,
        { headers: this.getBaseHeaders() }
      );
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Unable to retrieve Stripe account.';
      throw new ValidationError(`Stripe error: ${message}`);
    }

    const data = response.data;
    return {
      connected: true,
      stripeId: seller.stripeId,
      detailsSubmitted: Boolean(data.details_submitted),
      payoutsEnabled: Boolean(data.payouts_enabled),
      chargesEnabled: Boolean(data.charges_enabled),
      currency: data.default_currency,
    };
  }

  /**
   * Create a login link to the Stripe Express Dashboard for sellers who have already completed onboarding.
   */
  async createDashboardLoginLink(sellerId: string): Promise<{ url: string }> {
    const seller = await prisma.sellers.findUnique({
      where: { id: sellerId },
      select: { id: true, stripeId: true },
    });

    if (!seller || !seller.stripeId) {
      throw new ConflictError('Seller has not connected a Stripe account yet.');
    }

    let response: AxiosResponse<StripeLoginLinkResponse>;
    try {
      response = await axios.post<StripeLoginLinkResponse>(
        `https://api.stripe.com/v1/accounts/${seller.stripeId}/login_links`,
        '',
        { headers: this.getBaseHeaders() }
      );
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to create dashboard login link.';
      throw new ValidationError(`Stripe error: ${message}`);
    }

    return { url: response.data.url };
  }

  /**
   * Cryptographically verify a Stripe webhook signature (HMAC-SHA256).
   * Prevents replay attacks (tolerance defaults to 300 seconds).
   */
  verifyWebhookSignature(
    rawPayload: string | Buffer,
    signatureHeader: string | undefined,
    toleranceSeconds = 300
  ): StripeWebhookEvent {
    if (!signatureHeader) {
      throw new AuthError('Missing Stripe signature header.');
    }

    const secret = this.getWebhookSecret();
    const parts = signatureHeader.split(',');
    let timestamp: number | null = null;
    const signatures: string[] = [];

    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === 't') {
        timestamp = parseInt(value, 10);
      } else if (key === 'v1') {
        signatures.push(value);
      }
    }

    if (!timestamp || Number.isNaN(timestamp) || signatures.length === 0) {
      throw new ValidationError('Invalid Stripe signature format.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      throw new ValidationError('Stripe webhook signature has expired.');
    }

    const payloadString =
      typeof rawPayload === 'string'
        ? rawPayload
        : rawPayload.toString('utf8');

    const signedPayload = `${timestamp}.${payloadString}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const matched = signatures.some((sig) => {
      const sigBuffer = Buffer.from(sig, 'utf8');
      return (
        sigBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      );
    });

    if (!matched) {
      throw new AuthError('Stripe webhook signature verification failed.');
    }

    try {
      return JSON.parse(payloadString) as StripeWebhookEvent;
    } catch {
      throw new ValidationError('Invalid webhook JSON payload.');
    }
  }

  /**
   * Process a verified Stripe webhook event.
   */
  async processWebhookEvent(event: StripeWebhookEvent): Promise<{ handled: boolean; eventType: string }> {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as StripeAccountResponse;
        if (account.id) {
          // Find seller by stripeId and verify status
          const seller = await prisma.sellers.findUnique({
            where: { stripeId: account.id },
            select: { id: true },
          });
          if (seller) {
            // Account is updated and linked
            return { handled: true, eventType: event.type };
          }
        }
        return { handled: true, eventType: event.type };
      }
      default:
        return { handled: false, eventType: event.type };
    }
  }
}

export const stripeService = new StripeService();
