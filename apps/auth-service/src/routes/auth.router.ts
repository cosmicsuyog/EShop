import express , { Router} from "express";
import { loginUser, resetUserPassword, userForgotPassword, userRegistration , verifyUser, verifyUserForgetPassword } from "../controllers/auth.controller";

const router:Router =express.Router();

router.post("/user-registration",userRegistration);
router.post("/verify-registration",verifyUser);
router.post("/login-user",loginUser);
router.post("/forgot-password-user",userForgotPassword)
router.post("/reset-password-user",resetUserPassword);
router.post("/verify-forgot-password-user",verifyUserForgetPassword);



export default router;