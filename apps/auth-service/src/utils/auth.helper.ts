import { ValidationError } from '@packages/error-handler/index';
import crypto from 'crypto';
import redis from 'Packages/libs/redis';
import { sendEmail } from './sendMail';
import { NextFunction, Response, Request } from 'express';
import prisma from '@packages/libs/prisma';

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_RESET_COOKIE_NAME = 'passwordResetToken';
export const PASSWORD_RESET_COOKIE_PATH = '/api/reset-password-user';
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 5 * 60;

const passwordResetGrantKey = (token: string) =>
  `password_reset:${crypto.createHash('sha256').update(token).digest('hex')}`;

export const createPasswordResetGrant = async (
  userId: string,
  token: string
) =>
  redis.set(
    passwordResetGrantKey(token),
    userId,
    'EX',
    PASSWORD_RESET_TOKEN_TTL_SECONDS
  );

export const getPasswordResetGrantUserId = async (token: string) => {
  const userId = await redis.get(passwordResetGrantKey(token));
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
};

export const consumePasswordResetGrant = async (
  token: string,
  expectedUserId: string
) => {
  const result = await redis.eval(
    `
      local userId = redis.call('GET', KEYS[1])
      if userId and userId == ARGV[1] then
        redis.call('DEL', KEYS[1])
        return userId
      end
      return ''
    `,
    1,
    passwordResetGrantKey(token),
    expectedUserId
  );

  return typeof result === 'string' && result.length > 0 ? result : null;
};

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

export const checkOtpRestrictions = async (email: string): Promise<void> => {
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
    throw new ValidationError(
      'Please wait 1 minute before requesting a new OTP!'
    );
  }
};

export const trackOtpRequests = async (email: string): Promise<void> => {
  const result = await redis.eval(
    `
      if redis.call('GET', KEYS[2]) then
        return 0
      end

      local requests = redis.call('INCR', KEYS[1])
      if requests == 1 then
        redis.call('EXPIRE', KEYS[1], 3600)
      end

      if requests > 2 then
        redis.call('SET', KEYS[2], 'locked', 'EX', 3600)
        return 0
      end

      return requests
    `,
    2,
    `otp_requests_count:${email}`,
    `otp_spam_lock:${email}`
  );

  if (Number(result) === 0) {
    throw new ValidationError(
      'Too many requests! Please wait 1 hour before requesting again.'
    );
  }
};

export const sendOtp = async (
  name: string,
  email: string,
  template: string
): Promise<void | Response> => {
  const otp = crypto.randomInt(100000, 1000000).toString();

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
  const result = Number(
    await redis.eval(
      `
        if redis.call('GET', KEYS[3]) then
          return -2
        end

        local storedOtp = redis.call('GET', KEYS[1])
        if not storedOtp then
          return -1
        end

        if storedOtp ~= ARGV[1] then
          local attempts = redis.call('INCR', KEYS[2])
          if attempts == 1 then
            redis.call('EXPIRE', KEYS[2], 300)
          end
          if attempts >= 3 then
            redis.call('SET', KEYS[3], 'locked', 'EX', 1800)
            redis.call('DEL', KEYS[1], KEYS[2])
            return -2
          end
          return attempts
        end

        redis.call('DEL', KEYS[1], KEYS[2])
        return 0
      `,
      3,
      `otp:${email}`,
      `otp_attempts:${email}`,
      `otp_lock:${email}`,
      otp
    )
  );

  if (result === -2) {
    throw new ValidationError(
      'Too many attempts! Please wait 30 minutes before requesting again.'
    );
  }
  if (result === -1) {
    throw new ValidationError('Invalid or expired OTP!');
  }
  if (result > 0) {
    throw new ValidationError(`Incorrect OTP! ${3 - result} attempts left.`);
  }
};

export const handleForgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
  userType: 'user' | 'seller'
) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!email) throw new ValidationError('Email is required!');
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    const user =
      userType === 'user'
        ? await prisma.users.findUnique({ where: { email } })
        : null;

    if (user) {
      try {
        await checkOtpRestrictions(email);
        await trackOtpRequests(email);

        await sendOtp(user.name, email, 'forgot-password-user-mail');
      } catch {
        // Keep the response identical for unknown addresses, throttled requests,
        // and delivery failures so this endpoint cannot enumerate accounts.
      }
    }

    return res.status(202).json({
      message: 'If an account exists, password reset instructions will be sent.',
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyForgotPasswordOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    if (!email || !otp) {
      throw new ValidationError('Email and otp is required!');
    }
    if (!emailRegex.test(email) || !/^\d{6}$/.test(otp)) {
      throw new ValidationError('Invalid or expired OTP!');
    }

    await verifyOtp(email, otp);

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      throw new ValidationError('Invalid or expired OTP!');
    }

    const token = crypto.randomBytes(32).toString('hex');
    await createPasswordResetGrant(user.id, token);
    res.cookie(PASSWORD_RESET_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000,
      path: PASSWORD_RESET_COOKIE_PATH,
    });

    res.status(200).json({
      message: 'Code verified. You can now choose a new password.',
    });
  } catch (error) {
    return next(error);
  }
};
