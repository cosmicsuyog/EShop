import type { NextFunction, Request, Response } from 'express';
import { AuthError } from '../error-handler/index.js';
import { verifySellerToken } from '../libs/auth/verifySellerToken.js';

export type AuthenticatedSeller = {
  id: string;
  email: string;
  name: string;
  phone_number: string;
  country: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    authenticatedSeller?: AuthenticatedSeller;
  }
}

const getBearerToken = (authorization: string | undefined) => {
  if (!authorization) {
    return undefined;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  return match?.[1];
};

export const requireAuthenticatedSeller = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token =
    typeof req.cookies?.['seller-access-token'] === 'string'
      ? req.cookies['seller-access-token']
      : getBearerToken(req.header('authorization'));

  if (!token) {
    return next(new AuthError('Seller access token is required.'));
  }

  try {
    const claims = verifySellerToken(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      'access'
    );
    const { default: prisma } = await import('../libs/prisma/index.js');
    const seller = await prisma.sellers.findUnique({
      where: { id: claims.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone_number: true,
        country: true,
      },
    });

    if (!seller) {
      return next(new AuthError('Authenticated seller no longer exists.'));
    }

    req.authenticatedSeller = seller;
    return next();
  } catch (error) {
    return next(error);
  }
};
