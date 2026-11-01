import { Router } from 'express';
import {
  addItemToCart,
  clearCart,
  getCart,
  removeItemFromCart,
  updateCartItem,
} from '../controllers/cart.controller';
import { requireAuthenticatedUser } from '../middleware/auth.middleware';

const router = Router();

router.get('/cart', requireAuthenticatedUser, getCart);
router.post('/cart/items', requireAuthenticatedUser, addItemToCart);
router.patch(
  '/cart/items/:productId',
  requireAuthenticatedUser,
  updateCartItem
);
router.delete(
  '/cart/items/:productId',
  requireAuthenticatedUser,
  removeItemFromCart
);
router.delete('/cart', requireAuthenticatedUser, clearCart);

export default router;
