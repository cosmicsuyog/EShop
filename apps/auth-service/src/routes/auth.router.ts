import express, { Router } from 'express';
import {
  loginUser,
  resetUserPassword,
  userForgotPassword,
  userRegistration,
  verifyUser,
  verifyUserForgetPassword,
} from '../controllers/auth.controller';
import {
  getLoggedInUser,
  logoutUser,
  refreshUserAccessToken,
} from '../controllers/session.controller';
import { requireAuthenticatedUser } from '../middleware/auth.middleware';
import cartRouter from './cart.router';
import {
  createShop,
  getLoggedInSeller,
  loginSeller,
  logoutSeller,
  refreshSellerAccessToken,
  registerSeller,
  verifySeller,
} from '../controllers/seller.controller';
import {
  createStripeConnectLink,
  createStripeDashboardLink,
  getStripeAccountStatus,
  handleStripeWebhook,
} from '../controllers/stripe.controller';
import { requireAuthenticatedSeller } from '../middleware/seller-auth.middleware';

const router: Router = express.Router();

router.use(cartRouter);
router.post('/user-registration', userRegistration);
router.post('/verify-registration', verifyUser);
router.post('/login-user', loginUser);
router.get('/auth/logged-in-user', requireAuthenticatedUser, getLoggedInUser);
router.post('/auth/refresh-token', refreshUserAccessToken);
router.post('/auth/logout-user', logoutUser);
router.post('/forgot-password-user', userForgotPassword);
router.post('/reset-password-user', resetUserPassword);
router.post('/verify-forgot-password-user', verifyUserForgetPassword);
router.post('/seller-registration', registerSeller);
router.post('/verify-seller', verifySeller);
router.post('/login-seller', loginSeller);
router.get('/logged-in-seller', requireAuthenticatedSeller, getLoggedInSeller);
router.post('/refresh-seller-token', refreshSellerAccessToken);
router.post('/logout-seller', logoutSeller);
router.post('/create-shop', requireAuthenticatedSeller, createShop);
router.post('/create-stripe-link', requireAuthenticatedSeller, createStripeConnectLink);
router.get('/stripe-account-status', requireAuthenticatedSeller, getStripeAccountStatus);
router.post('/create-stripe-dashboard-link', requireAuthenticatedSeller, createStripeDashboardLink);
router.post('/stripe-webhook', handleStripeWebhook);

export default router;
