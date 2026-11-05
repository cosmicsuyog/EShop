// Register a new user
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  checkOtpRestrictions,
  consumePasswordResetGrant,
  getPasswordResetGrantUserId,
  PASSWORD_RESET_COOKIE_NAME,
  PASSWORD_RESET_COOKIE_PATH,
  sendOtp,
  trackOtpRequests,
  verifyOtp,
  validationRegistrationData,
  handleForgotPassword,
  verifyForgotPasswordOtp,
} from '../utils/auth.helper';
import prisma from '@packages/libs/prisma/index.js';
import {
  AuthError,
  ForbiddenError,
  ValidationError,
} from '@packages/error-handler/index';
import bcrypt from "bcryptjs"
import { setCookie } from '../utils/cookies/setCookies';
import { signUserToken } from '../utils/sessionTokens';
import redis from 'Packages/libs/redis';
import { REFRESH_TOKEN_TTL_SECONDS } from '../utils/sessionTokens';
import { trustedUserInterfaceOrigin } from '../utils/trustedOrigin';


export const userRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    validationRegistrationData(req.body, 'user');
    const { name, email } = req.body;

    const existingUser = await prisma.users.findUnique({ where: { email } });

    if (existingUser) {
      return next(new ValidationError('User already exists with this email!'));
    }

    await checkOtpRestrictions(email);
    await trackOtpRequests(email);
    await sendOtp(name, email, 'user-activation-mail');

    res.status(200).json({
      message: 'OTP sent to email. Please verify your account.',
    });
  } catch (error) {
    return next(error);
  }
};

// verify user with otp
export const verifyUser = async(req:Request,res:Response,next:NextFunction) => {
  try {
    const {email,otp,password,name} =req.body;
    if(!email || !otp || !password || !name){
      return next(new ValidationError("All fields are required!"));
    }

     const existingUser = await prisma.users.findUnique({
        where:{email}
      })

      if(existingUser){
        return next(new ValidationError("User already exist with this email!"))
      }
    await verifyOtp(email, otp);
    const hashedPassword = await bcrypt.hash(password,10); 

    await prisma.users.create({
      data:{name,email,password:hashedPassword}
    });

    res.status(201).json({
      sucess:true,
      message:"User registered successfully",
    })

    
  } catch (error) {
    return next(error)
  }
}


// login user
export const loginUser = async(req:Request,res:Response,next:NextFunction)=>{
  try{
    const{email,password} =req.body;
    if(!email || !password){
      return next(new ValidationError("Email and password are required!"))
    }
    const user = await prisma.users.findUnique({where:{email}});

    if(!user) return next(new AuthError("User doesnt exists"));

    // verify password
    const isMatch =await bcrypt.compare(password,user.password!);
    if(!isMatch){
      return next(new AuthError("InValid email or password"));
    }

    // generate access and refresh token 
    const sessionId = randomUUID();
    const sessionVersion = user.sessionVersion ?? 0;
    const accessToken = signUserToken(
      user.id,
      'access',
      process.env.ACCESS_TOKEN_SECRET as string,
      sessionId,
      sessionVersion
    );
    const refreshToken = signUserToken(
      user.id,
      'refresh',
      process.env.REFRESH_TOKEN_SECRET as string,
      sessionId,
      sessionVersion
    );
    await redis.set(
      `user_refresh_session:${sessionId}`,
      user.id,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS
    );
    // store the refresh and access token in an httpOnly secure cookie
    setCookie(res,"refreshToken",refreshToken)
    setCookie(res,"accessToken",accessToken)

    res.status(200).json({
      message:"Login successful",
      user:{
        id:user.id,
        email:user.email,
        name:user.name
      }
     
    })
  } catch(error){
    return next(error)
  }
}


// user forgot password 

export const userForgotPassword = async(req :Request,res:Response,next:NextFunction)=>{
    await handleForgotPassword(req,res,next,'user');
}

// verify forgot password OTP 
export const verifyUserForgetPassword = async(
  req:Request,
  res:Response,
  next:NextFunction
)  =>{
  await verifyForgotPasswordOtp(req,res,next);
}

// Reset user password 
export const resetUserPassword = async(
  req:Request,
  res:Response,
  next:NextFunction
)=>{
  try {
    if (req.get('origin') !== trustedUserInterfaceOrigin) {
      return next(
        new ForbiddenError('Password reset requests must come from the storefront.')
      );
    }

    const token = req.cookies?.[PASSWORD_RESET_COOKIE_NAME];
    const { newPassword } = req.body ?? {};
    if (
      typeof token !== 'string' ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      Buffer.byteLength(newPassword, 'utf8') > 72
    ) {
      return next(
        new ValidationError(
          'The reset request is invalid or expired, or the password does not meet the requirements.'
        )
      );
    }

    const userId = await getPasswordResetGrantUserId(token);
    if (!userId) {
      return next(
        new ValidationError('The reset request is invalid or expired. Request a new code.')
      );
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return next(
        new ValidationError('The reset request is invalid or expired. Request a new code.')
      );
    }

    if (user.password && (await bcrypt.compare(newPassword, user.password))) {
      return next(
        new ValidationError('Choose a password different from your current password.')
      );
    }

    const consumedUserId = await consumePasswordResetGrant(token, user.id);
    if (consumedUserId !== user.id) {
      return next(
        new ValidationError('The reset request is invalid or expired. Request a new code.')
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
      },
    });

    res.clearCookie(PASSWORD_RESET_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: PASSWORD_RESET_COOKIE_PATH,
    });

    return res.status(200).json({ message: 'Password reset successfully.' });
  } catch (error) {
    return next(error);
  }
}
