import type { NextFunction, Request, Response } from 'express';
import prisma from '@packages/libs/prisma/index.js';

/** Returns the non-sensitive storefront presentation configuration. */
export const getLayoutData = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const layout = await prisma.siteConfig.findFirst({
      select: { logo: true, banner: true, categories: true, subCategories: true },
    });
    return res.json({ success: true, layout: layout ?? { logo: null, banner: null, categories: [], subCategories: [] } });
  } catch (error) {
    return next(error);
  }
};
