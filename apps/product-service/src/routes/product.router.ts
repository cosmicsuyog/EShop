import { Router } from 'express';
import { getCatalogProducts } from '../controllers/product.controller.js';

const router = Router();

router.get('/products', getCatalogProducts);

export default router;
