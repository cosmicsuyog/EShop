import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '@packages/libs/prisma/index.js';
import {
  AuthError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '@packages/error-handler/index';
import {
  checkOtpRestrictions,
  emailRegex,
  sendOtp,
  trackOtpRequests,
  validationRegistrationData,
  verifyOtp,
} from '../utils/auth.helper';
import { setCookie } from '../utils/cookies/setCookies';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  signSellerToken,
  verifySellerToken,
} from '../utils/sessionTokens';
import { trustedUserInterfaceOrigin } from '../utils/trustedOrigin';

type SellerRegistrationData = {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  country: string;
};

type ShopData = {
  name: string;
  bio: string;
  address: string;
  opening_hours: string;
  website: string | null;
  category: string;
};

const requestRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Request data is required.');
  }
  return value as Record<string, unknown>;
};

const requiredString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required.`);
  }
  return value.trim();
};

const parseSellerRegistration = (value: unknown): SellerRegistrationData => {
  const body = requestRecord(value);
  validationRegistrationData(body, 'seller');

  const data = {
    name: requiredString(body.name, 'Name'),
    email: requiredString(body.email, 'Email').toLowerCase(),
    password:
      typeof body.password === 'string' && body.password.length > 0
        ? body.password
        : '',
    phone_number: requiredString(body.phone_number, 'Phone number'),
    country: requiredString(body.country, 'Country'),
  };

  if (!data.password) {
    throw new ValidationError('Password is required.');
  }
  if (!emailRegex.test(data.email)) {
    throw new ValidationError('Invalid email format.');
  }

  return data;
};

const parseShopData = (value: unknown): ShopData => {
  const body = requestRecord(value);
  const name = requiredString(body.name, 'Name');
  const bio = requiredString(body.bio, 'Bio');
  const address = requiredString(body.address, 'Address');
  const opening_hours = requiredString(body.opening_hours, 'Opening hours');
  const category = requiredString(body.category, 'Category');
  if (
    body.website !== undefined &&
    body.website !== null &&
    typeof body.website !== 'string'
  ) {
    throw new ValidationError('Website must be a URL.');
  }
  const rawWebsite =
    typeof body.website === 'string' ? body.website.trim() : '';

  if (
    name.length < 3 ||
    bio.length < 3 ||
    address.length < 3 ||
    opening_hours.length < 3
  ) {
    throw new ValidationError(
      'Name, bio, address, and opening hours must be at least 3 characters.'
    );
  }
  if (bio.split(/\s+/).length > 100) {
    throw new ValidationError('Bio must be at most 100 words long.');
  }
  if (
    rawWebsite &&
    !/^(https?:\/\/)?([\w\d-]+\.)+\w{2,}(\/.*)?$/i.test(rawWebsite)
  ) {
    throw new ValidationError('Invalid website URL.');
  }

  return {
    name,
    bio,
    address,
    opening_hours,
    website: rawWebsite || null,
    category,
  };
};

const setSellerSession = (res: Response, sellerId: string) => {
  const accessToken = signSellerToken(
    sellerId,
    'access',
    process.env.ACCESS_TOKEN_SECRET ?? ''
  );
  const refreshToken = signSellerToken(
    sellerId,
    'refresh',
    process.env.REFRESH_TOKEN_SECRET ?? ''
  );

  setCookie(res, 'seller-access-token', accessToken);
  setCookie(res, 'seller-refresh-token', refreshToken);
};

const isUniqueConstraintError = (error: unknown): error is { code: 'P2002' } =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
  );

export const registerSeller = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = parseSellerRegistration(req.body);
    const existingSeller = await prisma.sellers.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingSeller) {
      throw new ConflictError('Seller already exists with this email.');
    }

    await checkOtpRestrictions(data.email);
    await trackOtpRequests(data.email);
    await sendOtp(data.name, data.email, 'user-activation-mail');

    return res.status(200).json({
      success: true,
      message: 'OTP sent to email. Please verify your account.',
    });
  } catch (error) {
    return next(error);
  }
};

export const verifySeller = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = parseSellerRegistration(req.body);
    const body = requestRecord(req.body);
    const otp = requiredString(body.otp, 'OTP');

    if (!/^\d{4}$/.test(otp)) {
      throw new ValidationError('OTP must be a four-digit code.');
    }

    const existingSeller = await prisma.sellers.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existingSeller) {
      throw new ConflictError('Seller already exists with this email.');
    }

    await verifyOtp(data.email, otp);
    const password = await bcrypt.hash(data.password, 10);
    const seller = await prisma.sellers.create({
      data: {
        name: data.name,
        email: data.email,
        password,
        phone_number: data.phone_number,
        country: data.country,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        country: true,
      },
    });

    setSellerSession(res, seller.id);
    return res.status(201).json({
      success: true,
      message: 'Seller registered successfully.',
      seller,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return next(new ConflictError('Seller already exists with this email.'));
    }
    return next(error);
  }
};

export const loginSeller = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = requestRecord(req.body);
    const email = requiredString(body.email, 'Email').toLowerCase();
    if (typeof body.password !== 'string' || body.password.length === 0) {
      throw new ValidationError('Password is required.');
    }
    const password = body.password;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format.');
    }

    const seller = await prisma.sellers.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        country: true,
        password: true,
      },
    });
    if (!seller || !(await bcrypt.compare(password, seller.password))) {
      throw new AuthError('Invalid email or password.');
    }

    setSellerSession(res, seller.id);
    return res.status(200).json({
      success: true,
      message: 'Seller logged in successfully.',
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        phone_number: seller.phone_number,
        country: seller.country,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getLoggedInSeller = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const seller = req.authenticatedSeller;
    if (!seller) {
      throw new AuthError('Seller authentication is required.');
    }
    const profile = await prisma.sellers.findUnique({
      where: { id: seller.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone_number: true,
        country: true,
        shop: {
          select: {
            id: true,
            name: true,
            bio: true,
            category: true,
            website: true,
            address: true,
            opening_hours: true,
          },
        },
      },
    });

    if (!profile) {
      throw new AuthError('Authenticated seller no longer exists.');
    }

    return res.status(200).json({ success: true, seller: profile });
  } catch (error) {
    return next(error);
  }
};

export const refreshSellerAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.get('origin') !== trustedUserInterfaceOrigin) {
    return next(
      new ForbiddenError('Refresh requests must come from the storefront.')
    );
  }

  const refreshToken = req.cookies?.['seller-refresh-token'];
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    return next(new AuthError('Seller refresh token is required.'));
  }

  try {
    const claims = verifySellerToken(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      'refresh'
    );
    const seller = await prisma.sellers.findUnique({
      where: { id: claims.id },
      select: { id: true },
    });
    if (!seller) {
      return next(new AuthError('Authenticated seller no longer exists.'));
    }

    const accessToken = signSellerToken(
      seller.id,
      'access',
      process.env.ACCESS_TOKEN_SECRET ?? ''
    );
    setCookie(
      res,
      'seller-access-token',
      accessToken,
      ACCESS_TOKEN_TTL_SECONDS * 1000
    );
    return res.status(200).json({
      success: true,
      message: 'Seller access token refreshed successfully.',
    });
  } catch (error) {
    return next(error);
  }
};

export const logoutSeller = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.get('origin') !== trustedUserInterfaceOrigin) {
    return next(
      new ForbiddenError('Logout requests must come from the storefront.')
    );
  }

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    path: '/',
  };
  res.clearCookie('seller-access-token', cookieOptions);
  res.clearCookie('seller-refresh-token', cookieOptions);

  return res.status(200).json({
    success: true,
    message:
      'Signed out on this browser. Previously issued access tokens are not revoked.',
  });
};

export const createShop = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const seller = req.authenticatedSeller;
    if (!seller) {
      throw new AuthError('Seller authentication is required.');
    }

    const data = parseShopData(req.body);
    const existingShop = await prisma.shops.findUnique({
      where: { sellerId: seller.id },
      select: { id: true },
    });
    if (existingShop) {
      throw new ConflictError('This seller already has a shop.');
    }

    const shop = await prisma.shops.create({
      data: {
        ...data,
        sellerId: seller.id,
      },
      select: {
        id: true,
        name: true,
        bio: true,
        category: true,
        website: true,
        address: true,
        opening_hours: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Shop created successfully.',
      shop,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return next(new ConflictError('This seller already has a shop.'));
    }
    return next(error);
  }
};
