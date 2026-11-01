import type { Response } from 'express';

const DEFAULT_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const setCookie = (
  res: Response,
  name: string,
  value: string,
  maxAge = DEFAULT_COOKIE_MAX_AGE
) => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge,
  });
};
