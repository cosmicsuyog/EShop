// Register a new user
import { NextFunction, Request, Response } from 'express';
import {
  checkOtpRestrictions,
  sendOtp,
  trackOtpRequests,
  verifyOtp,
  validationRegistrationData,
  handleForgotPassword,
  verifyForgotPasswordOtp,
} from '../utils/auth.helper';
import prisma from '@packages/libs/prisma/index.js';
import { AuthError, ValidationError } from '@packages/error-handler/index';
import bcrypt from "bcryptjs"
import { setCookie } from '../utils/cookies/setCookies';
import { signUserToken } from '../utils/sessionTokens';


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

    await checkOtpRestrictions(email, next);
    await trackOtpRequests(email, next);
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
    await verifyOtp(email,otp,next)
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
    const accessToken = signUserToken(
      user.id,
      'access',
      process.env.ACCESS_TOKEN_SECRET as string
    );
    const refreshToken = signUserToken(
      user.id,
      'refresh',
      process.env.REFRESH_TOKEN_SECRET as string
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
    const {email ,newPassword} = req.body;

    if(!email || !newPassword){
      return next(new ValidationError("Email and new password is required!"))
    }
    const user = await prisma.users.findUnique({where:{email}});
    if(!user) return next(new ValidationError("User not found!"));

    // compare new password with the existing one
    const isSamePassword =await bcrypt.compare(newPassword,user.password!);

    if(isSamePassword){
      return next(new ValidationError("New Password cannot be the same as the old password!"))
    }

    // hash the new password 
    const hashedPassword = await bcrypt.hash(newPassword,10);

    await prisma.users.update({
      where:{email},
      data:{password:hashedPassword},
    })

    res.status(200).json({
      message:"Password reset successfully"
    })

    
  } catch (error) {
    next(error)
  }
}