import { Router } from 'express';
import { requireAuthenticatedUser } from '@packages/middleware/user-auth.middleware.js';
import { getRecommendedProducts } from '../controllers/recommendation.controller.js';

const router = Router();
router.get('/get-recommended-products', requireAuthenticatedUser, getRecommendedProducts);
export default router;
