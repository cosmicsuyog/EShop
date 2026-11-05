import jwt, { JsonWebTokenError } from 'jsonwebtoken';
import { AuthError } from '../../error-handler/index.js';

export type SellerTokenUse = 'access' | 'refresh';

type SellerTokenClaims = jwt.JwtPayload & {
  id: string;
  jti?: string;
  role: 'seller';
  tokenUse: SellerTokenUse;
};

export const verifySellerToken = (
  token: string,
  secret: string | undefined,
  tokenUse: SellerTokenUse
): SellerTokenClaims => {
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
    payload.role !== 'seller' ||
    payload.tokenUse !== tokenUse ||
    (tokenUse === 'refresh' &&
      (typeof payload.jti !== 'string' || payload.jti.length === 0)) ||
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new AuthError(`Invalid ${tokenUse} token.`);
  }

  return payload as SellerTokenClaims;
};
