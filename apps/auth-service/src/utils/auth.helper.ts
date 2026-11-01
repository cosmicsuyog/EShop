import { ValidationError } from '@packages/error-handler/index';
import crypto from 'crypto';
import redis from 'Packages/libs/redis';
import { sendEmail } from './sendMail';
import { NextFunction, Response, Request } from 'express';
import prisma from '@packages/libs/prisma';

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validationRegistrationData = (
  data: unknown,
  userType: 'user' | 'seller'
) => {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Missing required fields!');
  }

  const { name, email, password, phone_number, country } = data as Record<
    string,
    unknown
  >;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    !password ||
    (userType === 'seller' &&
      (typeof phone_number !== 'string' ||
        !phone_number.trim() ||
        typeof country !== 'string' ||
        !country.trim()))
  ) {
    throw new ValidationError(`Missing required fields!`);
  }

  if (!emailRegex.test(email.trim())) {
    throw new ValidationError('Invalid email format');
  }
};

export const checkOtpRestrictions = async (
  email: string
): Promise<void> => {
  if (await redis.get(`otp_lock:${email}`)) {
    throw new ValidationError(
      'Account locked due to multiple failed attempts! Try again after 30 minutes'
    );
  }

  if (await redis.get(`otp_spam_lock:${email}`)) {
    throw new ValidationError(
      'Too many OTP requests! Please wait 1 hour before requesting again.'
    );
  }

  if (await redis.get(`otp_cooldown:${email}`)) {
    throw new ValidationError('Please wait 1 minute before requesting a new OTP!');
  }
};

export const trackOtpRequests = async (
  email: string
): Promise<void> => {
  const otpRequestKey = `otp_requests_count:${email}`;
  const otpRequests: number = parseInt((await redis.get(otpRequestKey)) || '0');

  if (otpRequests >= 2) {
    await redis.set(`otp_spam_lock:${email}`, 'locked', 'EX', 3600); // Lock for 1 hour

    throw new ValidationError(
      'Too many requests! Please wait 1 hour before requesting again.'
    );
  }

  await redis.set(otpRequestKey, otpRequests + 1, 'EX', 3600); // Track requests for 1 hour
};

export const sendOtp = async (
  name: string,
  email: string,
  template: string
): Promise<void | Response> => {
  const otp = crypto.randomInt(1000, 9999).toString();

  const sent = await sendEmail(email, 'Verify your email', template, {
    name,
    otp,
  });
  if (!sent) {
    throw new Error('Verification email could not be sent.');
  }

  await redis.set(`otp:${email}`, otp, 'EX', 300);
  await redis.set(`otp_cooldown:${email}`, 'true', 'EX', 60); // otp_cooldown: How long to wait before allowing sending another otp request
};

export const verifyOtp = async (
  email: string,
  otp: string
): Promise<void | Response> => {
  const storedOtp = await redis.get(`otp:${email}`);

  if (!storedOtp) throw new ValidationError(`Invalid or expired OTP!`);

  const failedAttemptsKey = `otp_attempts:${email}`;
  const failedAttempts: number = parseInt(
    (await redis.get(failedAttemptsKey)) || '0'
  );

  if (storedOtp !== otp) {
    if (failedAttempts >= 2) {
      await redis.set(`otp_lock:${email}`, 'locked', 'EX', 1800); // Lock for 30 min
      await redis.del(`otp:${email}`, failedAttemptsKey);

      throw new ValidationError(
        'Too many attempts! Please wait 30 minutes before requesting again.'
      );
    }

    await redis.set(failedAttemptsKey, failedAttempts + 1, 'EX', 300);

    throw new ValidationError(
      `Incorrect OTP! ${2 - failedAttempts} attempts left.`
    );
  }

  await redis.del(`otp:${email}`, failedAttemptsKey);
};

export const handleForgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
  userType:"user"|"seller"
) => {
  try {
    const { email } = req.body;
    if (!email) throw new ValidationError('Email is required!');

    // find user/seller in DB
    const user =
      userType === 'user' &&
      (await prisma.users.findUnique({ where: { email } }));

    if (!user) throw new ValidationError(`${userType} not found!`);
    await checkOtpRestrictions(email);
    await trackOtpRequests(email);

    // Generate OTP and send Email
    await sendOtp(user.name, email, 'forgot-password-user-mail');
    return res.status(200).json({
      message: 'OTP sent to email.Please verify your account.',
    });
  } catch (error) {
    return next(error);
  }
};


export const verifyForgotPasswordOtp = async(
    req:Request,
    res:Response,
    next:NextFunction,
) =>{
    try {
        const {email,otp} = req.body;
        if(!email || !otp){
          throw new ValidationError("Email and otp is required!")
        }
        await verifyOtp(email, otp);
        res
          .status(200)
          .json({
            message:"OTP verified. You can now reset your password."
          })
    } catch (error) {
        return next(error)
    }
}