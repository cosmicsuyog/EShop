import type { NextFunction, Request, Response } from 'express';
import prisma from '@packages/libs/prisma/index.js';
import { AuthError } from '@packages/error-handler/index';
import { verifyUserToken } from '../utils/sessionTokens';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    authenticatedUser?: AuthenticatedUser;
  }
}

const getBearerToken = (authorization: string | undefined) => {
  if (!authorization) {
    return undefined;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  return match?.[1];
};

export const requireAuthenticatedUser = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token =
    typeof req.cookies?.accessToken === 'string'
      ? req.cookies.accessToken
      : getBearerToken(req.header('authorization'));

  if (!token) {
    return next(new AuthError('Access token is required.'));
  }

  try {
    const claims = verifyUserToken(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      'access'
    );
    const user = await prisma.users.findUnique({
      where: { id: claims.id },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return next(new AuthError('Authenticated user no longer exists.'));
    }

    req.authenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
    return next();
  } catch (error) {
    return next(error);
  }
};
