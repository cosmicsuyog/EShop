import type { NextFunction, Request, Response } from 'express';
import prisma from '@packages/libs/prisma/index.js';
import { AuthError, ForbiddenError } from '@packages/error-handler/index';
import { randomUUID } from 'node:crypto';
import redis from 'Packages/libs/redis';
import { setCookie } from '../utils/cookies/setCookies';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
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
      select: { id: true, sessionVersion: true },
    });

    if (!user) {
      return next(new AuthError('Authenticated user no longer exists.'));
    }

    if ((user.sessionVersion ?? 0) !== claims.sessionVersion) {
      return next(new AuthError('Refresh token has been revoked.'));
    }

    const nextSessionId = randomUUID();
    const sessionVersion = user.sessionVersion ?? 0;
    const accessToken = signUserToken(
      user.id,
      'access',
      process.env.ACCESS_TOKEN_SECRET ?? '',
      nextSessionId,
      sessionVersion
    );
    const nextRefreshToken = signUserToken(
      user.id,
      'refresh',
      process.env.REFRESH_TOKEN_SECRET ?? '',
      nextSessionId,
      sessionVersion
    );
    const rotated = Number(
      await redis.eval(
        `
          if redis.call('GET', KEYS[1]) ~= ARGV[1] then
            return 0
          end

          redis.call('DEL', KEYS[1])
          redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
          return 1
        `,
        2,
        `user_refresh_session:${claims.jti}`,
        `user_refresh_session:${nextSessionId}`,
        user.id,
        REFRESH_TOKEN_TTL_SECONDS
      )
    );
    if (rotated !== 1) {
      return next(new AuthError('Refresh token has been revoked.'));
    }

    setCookie(res, 'accessToken', accessToken, ACCESS_TOKEN_TTL_SECONDS * 1000);
    setCookie(
      res,
      'refreshToken',
      nextRefreshToken,
      REFRESH_TOKEN_TTL_SECONDS * 1000
    );

    return res.status(200).json({
      success: true,
      message: 'Session refreshed successfully.',
    });
  } catch (error) {
    return next(error);
  }
};

export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.get('origin') !== trustedUserInterfaceOrigin) {
    return next(
      new ForbiddenError('Logout requests must come from the storefront.')
    );
  }

  try {
    const refreshToken = req.cookies?.refreshToken;
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      try {
        const claims = verifyUserToken(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET,
          'refresh'
        );
        await redis.eval(
          `
            if redis.call('GET', KEYS[1]) == ARGV[1] then
              return redis.call('DEL', KEYS[1])
            end
            return 0
          `,
          1,
          `user_refresh_session:${claims.jti}`,
          claims.id
        );
      } catch (error) {
        if (!(error instanceof AuthError)) {
          throw error;
        }
      }
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
    message: 'Signed out on this browser.',
  });
  } catch (error) {
    return next(error);
  }
};
