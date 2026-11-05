import { Router } from 'express';
import {
  getCatalogCategories,
  getCatalogProduct,
  getCatalogProducts,
  getCatalogSubcategories,
} from '../controllers/product.controller.js';
import {
  createSellerProduct,
  deleteSellerProduct,
  getSellerProducts,
  restoreSellerProduct,
} from '../controllers/seller-product.controller.js';
import { requireAuthenticatedSeller } from '@packages/middleware/seller-auth.middleware.js';

const router = Router();

router.get('/categories', getCatalogCategories);
router.get('/subcategories', getCatalogSubcategories);
router.get('/products', getCatalogProducts);
router.get('/products/:slug', getCatalogProduct);
router.post('/create-product', requireAuthenticatedSeller, createSellerProduct);
router.get('/get-shop-products', requireAuthenticatedSeller, getSellerProducts);
router.delete(
  '/delete-product/:productId',
  requireAuthenticatedSeller,
  deleteSellerProduct
);
router.put(
  '/restore-product/:productId',
  requireAuthenticatedSeller,
  restoreSellerProduct
);

export default router;
