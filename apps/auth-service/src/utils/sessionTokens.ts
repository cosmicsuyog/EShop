import jwt, { JsonWebTokenError } from 'jsonwebtoken';
import { AuthError } from '@packages/error-handler/index';
import {
  verifySellerToken,
  type SellerTokenUse as SharedSellerTokenUse,
} from '@packages/libs/auth/verifySellerToken';

export { verifySellerToken };

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export type UserTokenUse = 'access' | 'refresh';

type UserTokenClaims = jwt.JwtPayload & {
  id: string;
  role: 'user';
  tokenUse: UserTokenUse;
  jti: string;
  sessionVersion: number;
};

export type SellerTokenUse = SharedSellerTokenUse;

export const signUserToken = (
  userId: string,
  tokenUse: UserTokenUse,
  secret: string,
  jti: string,
  sessionVersion: number
) => {
  if (!secret) {
    throw new Error(
      `${
        tokenUse === 'access' ? 'ACCESS' : 'REFRESH'
      }_TOKEN_SECRET is not configured.`
    );
  }

  return jwt.sign(
    { id: userId, role: 'user', tokenUse, jti, sessionVersion },
    secret,
    {
    expiresIn:
      tokenUse === 'access'
        ? ACCESS_TOKEN_TTL_SECONDS
        : REFRESH_TOKEN_TTL_SECONDS,
    }
  );
};

export const signSellerToken = (
  sellerId: string,
  tokenUse: SellerTokenUse,
  secret: string,
  jti: string
) => {
  if (!secret) {
    throw new Error(
      `${
        tokenUse === 'access' ? 'ACCESS' : 'REFRESH'
      }_TOKEN_SECRET is not configured.`
    );
  }

  return jwt.sign(
    { id: sellerId, role: 'seller', tokenUse, jti },
    secret,
    {
      expiresIn:
        tokenUse === 'access'
          ? ACCESS_TOKEN_TTL_SECONDS
          : REFRESH_TOKEN_TTL_SECONDS,
    }
  );
};

export const verifyUserToken = (
  token: string,
  secret: string | undefined,
  tokenUse: UserTokenUse
): UserTokenClaims => {
  if (!secret) {
    throw new Error(
      `${
        tokenUse === 'access' ? 'ACCESS' : 'REFRESH'
      }_TOKEN_SECRET is not configured.`
    );
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret);
  } catch (error) {
    if (error instanceof JsonWebTokenError) {
      throw new AuthError(`Invalid or expired ${tokenUse} token.`);
    }
    throw error;
  }

  if (
    typeof payload === 'string' ||
    typeof payload.id !== 'string' ||
    payload.id.length === 0 ||
    payload.role !== 'user' ||
    payload.tokenUse !== tokenUse ||
    typeof payload.jti !== 'string' ||
    payload.jti.length === 0 ||
    !Number.isInteger(payload.sessionVersion) ||
    (payload.sessionVersion as number) < 0 ||
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new AuthError(`Invalid ${tokenUse} token.`);
  }

  return payload as UserTokenClaims;
};
