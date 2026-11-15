import { Router } from 'express';
import { addNewAdmin, getAllAdmins, getAllCustomizations, updateCustomizations, getAllEvents, getAllProducts, getAllSellers, getAllUsers } from '../controllers/admin.controller.js';
import { requireAuthenticatedAdmin, requireAdmin } from '@packages/middleware/admin-auth.middleware.js';

const router = Router();
router.get('/get-all-products', requireAuthenticatedAdmin, requireAdmin, getAllProducts);
router.get('/get-all-events', requireAuthenticatedAdmin, requireAdmin, getAllEvents);
router.get('/get-all-sellers', requireAuthenticatedAdmin, requireAdmin, getAllSellers);
router.get('/get-all-users', requireAuthenticatedAdmin, requireAdmin, getAllUsers);
router.get('/get-all-admins', requireAuthenticatedAdmin, requireAdmin, getAllAdmins);
router.put('/add-new-admin', requireAuthenticatedAdmin, requireAdmin, addNewAdmin);
router.get('/get-all', getAllCustomizations);
router.put('/customizations', requireAuthenticatedAdmin, requireAdmin, updateCustomizations);
export default router;
