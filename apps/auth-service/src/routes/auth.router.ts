import express, { Router } from 'express';
import {
  loginUser,
  loginAdmin,
  changePassword,
  loginUserWithGoogle,
  createGoogleSignInChallenge,
  resetUserPassword,
  userForgotPassword,
  userRegistration,
  verifyUser,
  verifyUserForgetPassword,
} from '../controllers/auth.controller';
import {
  getLoggedInUser,
  getLoggedInAdmin,
  logoutAdmin,
  logoutUser,
  refreshUserAccessToken,
} from '../controllers/session.controller';
import { requireAuthenticatedUser } from '../middleware/auth.middleware';
import { requireAuthenticatedAdmin, requireAdmin } from '@packages/middleware/admin-auth.middleware.js';
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
import { trackUserEvent } from '../controllers/user-events.controller';
import {
  addUserAddress,
  deleteUserAddress,
  getUserAddresses,
} from '../controllers/address.controller';
import { followShop, isFollowingShop, unfollowShop } from '../controllers/shop.controller';
import { getLayoutData } from '../controllers/layout.controller';

const router: Router = express.Router();

router.use(cartRouter);
router.get('/get-layouts', getLayoutData);
router.post('/user-registration', userRegistration);
router.post('/verify-registration', verifyUser);
router.post('/login-user', loginUser);
if (loginAdmin) router.post('/login-admin', loginAdmin);
router.post('/google-sign-in-challenge', createGoogleSignInChallenge);
router.post('/login-google', loginUserWithGoogle);
router.get('/auth/logged-in-user', requireAuthenticatedUser, getLoggedInUser);
if (getLoggedInAdmin) router.get('/logged-in-admin', requireAuthenticatedAdmin, requireAdmin, getLoggedInAdmin);
if (logoutAdmin) router.post('/logout-admin', requireAuthenticatedAdmin, requireAdmin, logoutAdmin);
if (changePassword) router.post('/change-password', requireAuthenticatedUser, changePassword);
router.post('/auth/refresh-token', refreshUserAccessToken);
router.post('/auth/logout-user', logoutUser);
router.post('/forgot-password-user', userForgotPassword);
router.post('/reset-password-user', resetUserPassword);
router.post('/verify-forgot-password-user', verifyUserForgetPassword);
router.post('/user-events', requireAuthenticatedUser, trackUserEvent);
router.get('/is-following/:shopId', requireAuthenticatedUser, isFollowingShop);
router.post('/follow-shop', requireAuthenticatedUser, followShop);
router.post('/unfollow-shop', requireAuthenticatedUser, unfollowShop);
router.post('/add-address', requireAuthenticatedUser, addUserAddress);
router.delete('/delete-address/:addressId', requireAuthenticatedUser, deleteUserAddress);
router.get('/shipping-addresses', requireAuthenticatedUser, getUserAddresses);
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
