import express , { Router} from "express";
import { loginUser, resetUserPassword, userForgotPassword, userRegistration , verifyUser, verifyUserForgetPassword } from "../controllers/auth.controller";
import {
  getLoggedInUser,
  logoutUser,
  refreshUserAccessToken,
} from '../controllers/session.controller';
import { requireAuthenticatedUser } from '../middleware/auth.middleware';
import cartRouter from './cart.router';

const router:Router =express.Router();

router.use(cartRouter);
router.post("/user-registration",userRegistration);
router.post("/verify-registration",verifyUser);
router.post("/login-user",loginUser);
router.get(
  '/auth/logged-in-user',
  requireAuthenticatedUser,
  getLoggedInUser
);
router.post('/auth/refresh-token', refreshUserAccessToken);
router.post('/auth/logout-user', logoutUser);
router.post("/forgot-password-user",userForgotPassword)
router.post("/reset-password-user",resetUserPassword);
router.post("/verify-forgot-password-user",verifyUserForgetPassword);



export default router;