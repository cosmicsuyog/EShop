import type { NextFunction, Request, Response } from 'express';
import prisma from '@packages/libs/prisma/index.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@packages/error-handler/index.js';

const pagination = (req: Request, defaultLimit = 20) => {
  const rawPage = Number.parseInt(String(req.query.page ?? '1'), 10);
  const rawLimit = Number.parseInt(String(req.query.limit ?? defaultLimit), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
};

const productSelect = {
  id: true, title: true, slug: true, sale_price: true, regular_price: true, stock: true,
  category: true, subcategory: true, createdAt: true, rattings: true, starting_date: true,
  ending_date: true, isDeleted: true,
  images: { take: 1, select: { id: true, url: true, file_id: true } },
  shops: { select: { id: true, name: true } },
} as const;

const productResponse = (data: unknown[], total: number, page: number, limit: number) => ({
  success: true,
  data: data.map((item) => {
    const { shops, ...product } = item as { shops?: unknown };
    return { ...product, shop: shops };
  }),
  meta: { totalProducts: total, currentPage: page, totalPages: Math.ceil(total / limit) },
});

/** Return paginated regular products for the admin dashboard. */
export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = pagination(req);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = { starting_date: null, ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { slug: { contains: search, mode: 'insensitive' as const } }] } : {}) };
    const [data, total] = await Promise.all([
      prisma.products.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: productSelect }),
      prisma.products.count({ where }),
    ]);
    return res.json(productResponse(data, total, page, limit));
  } catch (error) { return next(error); }
};

/** Return paginated events/offers, identified by a non-null starting date. */
export const getAllEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = pagination(req);
    const where = { starting_date: { not: null } };
    const [data, total] = await Promise.all([
      prisma.products.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: productSelect }),
      prisma.products.count({ where }),
    ]);
    return res.json(productResponse(data, total, page, limit));
  } catch (error) { return next(error); }
};

/** Return safe, paginated seller records and their shop summary. */
export const getAllSellers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = pagination(req);
    const [data, totalSellers] = await Promise.all([
      prisma.sellers.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, phone_number: true, country: true, createdAt: true, images: { take: 1, select: { id: true, url: true, file_id: true } }, shop: { select: { id: true, name: true, address: true } } } }),
      prisma.sellers.count(),
    ]);
    return res.json({ success: true, data, meta: { totalSellers, currentPage: page, totalPages: Math.ceil(totalSellers / limit) } });
  } catch (error) { return next(error); }
};

/** Return safe, paginated users without credentials or session data. */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = pagination(req);
    const [data, totalUsers] = await Promise.all([
      prisma.users.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, createdAt: true, avatar: { take: 1, select: { id: true, url: true, file_id: true } } } }),
      prisma.users.count(),
    ]);
    return res.json({ success: true, data, meta: { totalUsers, currentPage: page, totalPages: Math.ceil(totalUsers / limit) } });
  } catch (error) { return next(error); }
};

/** Return the current administrator roster. */
export const getAllAdmins = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.users.findMany({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
};

/** Promote or demote a user while protecting the caller and last admin. */
export const addNewAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const role = req.body?.role;
    if (!email || (role !== 'admin' && role !== 'user')) throw new ValidationError('A valid email and role are required.');
    const user = await prisma.users.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
    if (!user) throw new NotFoundError('User not found');
    if (user.id === req.adminUser?.id && role !== 'admin') throw new ForbiddenError('You cannot demote your own admin account.');
    if (user.role === 'admin' && role === 'user') {
      const adminCount = await prisma.users.count({ where: { role: 'admin' } });
      if (adminCount <= 1) throw new ConflictError('The last administrator cannot be removed.');
    }
    const updated = await prisma.users.update({ where: { id: user.id }, data: { role }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
    return res.json({ success: true, user: updated });
  } catch (error) { return next(error); }
};

/** Return public customization data, with catalog-derived category fallbacks. */
export const getAllCustomizations = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [categories, subcategories, layout] = await Promise.all([
      prisma.products.findMany({ where: { starting_date: null, isDeleted: false }, distinct: ['category'], select: { category: true } }),
      prisma.products.findMany({ where: { starting_date: null, isDeleted: false }, distinct: ['subcategory'], select: { subcategory: true } }),
      prisma.siteConfig.findFirst({ select: { logo: true, banner: true, categories: true, subCategories: true } }),
    ]);
    return res.json({ success: true, categories: layout?.categories.length ? layout.categories : categories.map((item) => item.category), subCategories: layout?.subCategories.length ? layout.subCategories : subcategories.map((item) => item.subcategory), logo: layout?.logo ?? null, banner: layout?.banner ?? null });
  } catch (error) { return next(error); }
};

/** Updates the public storefront presentation fields without accepting secrets. */
export const updateCustomizations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logo = req.body?.logo == null ? null : String(req.body.logo).trim();
    const banner = req.body?.banner == null ? null : String(req.body.banner).trim();
    if ((logo && logo.length > 2_000) || (banner && banner.length > 2_000)) throw new ValidationError('Logo and banner URLs must be at most 2,000 characters.');
    const layout = await prisma.siteConfig.findFirst({ select: { id: true } });
    const data = { logo: logo || null, banner: banner || null };
    const updated = layout
      ? await prisma.siteConfig.update({ where: { id: layout.id }, data, select: { logo: true, banner: true, categories: true, subCategories: true } })
      : await prisma.siteConfig.create({ data, select: { logo: true, banner: true, categories: true, subCategories: true } });
    return res.json({ success: true, layout: updated });
  } catch (error) { return next(error); }
};
