import { Router } from 'express';
import {
  getCatalogCategories,
  getCatalogProduct,
  getCatalogProducts,
  getCatalogSubcategories,
} from '../controllers/product.controller.js';

const router = Router();

router.get('/categories', getCatalogCategories);
router.get('/subcategories', getCatalogSubcategories);
router.get('/products', getCatalogProducts);
router.get('/products/:slug', getCatalogProduct);

export default router;
