import type { NextFunction, Request, Response } from 'express';
import prisma from '@packages/libs/prisma/index.js';
import { AuthError } from '@packages/error-handler/index.js';
import { recommendProducts } from '../services/recommendation.service.js';

const MIN_ACTIONS = 50;
const RETRAIN_AFTER_MS = 60 * 60 * 1000;
const FALLBACK_COUNT = 10;
const MAX_CANDIDATES = 200;
const trainingLocks = new Map<string, Promise<string[]>>();
let activeTrainings = 0;
const MAX_CONCURRENT_TRAININGS = 2;

/** Returns cached recommendations, training only when activity and cache policy allow it. */
export const getRecommendedProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.authenticatedUser?.id;
    if (!userId) return next(new AuthError('Access token is required.'));
    const products = await prisma.products.findMany({
      where: { starting_date: null, isDeleted: false, stock: { gt: 0 }, status: 'Active' },
      orderBy: { createdAt: 'desc' },
      take: MAX_CANDIDATES,
      include: { images: true, shops: true },
    });
    const analytics = await prisma.userAnalytics.findUnique({ where: { userId }, select: { actions: true, recommendations: true, lastTrained: true } });
    const actions = Array.isArray(analytics?.actions) ? analytics.actions : [];
    let ids: string[];
    if (actions.length < MIN_ACTIONS || !analytics) {
      ids = products.slice(0, FALLBACK_COUNT).map((product) => product.id);
    } else if (analytics.lastTrained && Date.now() - analytics.lastTrained.getTime() < RETRAIN_AFTER_MS && analytics.recommendations.length > 0) {
      ids = analytics.recommendations;
    } else if (trainingLocks.has(userId)) {
      ids = await trainingLocks.get(userId)!;
    } else if (activeTrainings >= MAX_CONCURRENT_TRAININGS) {
      ids = products.slice(0, FALLBACK_COUNT).map((product) => product.id);
    } else {
      activeTrainings += 1;
      const training = recommendProducts(userId, products).then(async (trainedIds) => {
        const nextIds = trainedIds.length > 0 ? trainedIds : products.slice(0, FALLBACK_COUNT).map((product) => product.id);
        await prisma.userAnalytics.update({ where: { userId }, data: { recommendations: nextIds, lastTrained: new Date() } });
        return nextIds;
      }).finally(() => { activeTrainings -= 1; trainingLocks.delete(userId); });
      trainingLocks.set(userId, training);
      ids = await training;
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    const recommendations = ids.map((id) => byId.get(id)).filter((product): product is (typeof products)[number] => Boolean(product));
    return res.json({ success: true, recommendations });
  } catch (error) {
    return next(error);
  }
};
