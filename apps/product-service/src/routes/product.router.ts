import { Router } from 'express';
import {
  getCatalogProduct,
  getCatalogProducts,
} from '../controllers/product.controller.js';

const router = Router();

router.get('/products', getCatalogProducts);
router.get('/products/:slug', getCatalogProduct);

export default router;
