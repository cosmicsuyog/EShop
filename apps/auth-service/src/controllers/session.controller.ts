import type { NextFunction, Request, Response } from 'express';
import prisma from '@packages/libs/prisma/index.js';
import { AuthError, ForbiddenError } from '@packages/error-handler/index';
import { setCookie } from '../utils/cookies/setCookies';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  signUserToken,
  verifyUserToken,
} from '../utils/sessionTokens';
import { trustedUserInterfaceOrigin } from '../utils/trustedOrigin';

export const getLoggedInUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.authenticatedUser) {
    return next(new AuthError());
  }

  return res.status(200).json({
    success: true,
    user: req.authenticatedUser,
  });
};

export const refreshUserAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.get('origin') !== trustedUserInterfaceOrigin) {
    return next(
      new ForbiddenError('Refresh requests must come from the storefront.')
    );
  }

  const refreshToken = req.cookies?.refreshToken;
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    return next(new AuthError('Refresh token is required.'));
  }

  try {
    const claims = verifyUserToken(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      'refresh'
    );
    const user = await prisma.users.findUnique({
      where: { id: claims.id },
      select: {
        id: true,
      },
    });

    if (!user) {
      return next(new AuthError('Authenticated user no longer exists.'));
    }

    const accessToken = signUserToken(
      user.id,
      'access',
      process.env.ACCESS_TOKEN_SECRET ?? ''
    );
    setCookie(res, 'accessToken', accessToken, ACCESS_TOKEN_TTL_SECONDS * 1000);

    return res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully.',
    });
  } catch (error) {
    return next(error);
  }
};

export const logoutUser = (
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
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);

  return res.status(200).json({
    success: true,
    message:
      'Signed out on this browser. Previously issued access tokens are not revoked.',
  });
};
