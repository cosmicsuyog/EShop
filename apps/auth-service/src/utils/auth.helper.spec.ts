import redis from 'Packages/libs/redis';
import prisma from '@packages/libs/prisma';
import { sendEmail } from './sendMail';
import {
  consumePasswordResetGrant,
  createPasswordResetGrant,
  getPasswordResetGrantUserId,
  handleForgotPassword,
  PASSWORD_RESET_COOKIE_NAME,
  PASSWORD_RESET_COOKIE_PATH,
  sendOtp,
  trackOtpRequests,
  verifyForgotPasswordOtp,
  verifyOtp,
} from './auth.helper';
import type { NextFunction, Request, Response } from 'express';

jest.mock('Packages/libs/redis', () => ({
  __esModule: true,
  default: {
    eval: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('./sendMail', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@packages/libs/prisma', () => ({
  __esModule: true,
  default: {
    users: {
      findUnique: jest.fn(),
    },
  },
}));

describe('atomic OTP verification and request limits', () => {
  const redisEval = jest.mocked(redis.eval);
  const redisGet = jest.mocked(redis.get);
  const redisSet = jest.mocked(redis.set);
  const sendEmailMock = jest.mocked(sendEmail);
  const findUser = jest.mocked(prisma.users.findUnique);

  beforeEach(() => {
    redisEval.mockReset();
    redisGet.mockReset();
    redisSet.mockReset();
    sendEmailMock.mockReset();
    findUser.mockReset();
  });

  it('atomically accepts a valid OTP and consumes it once', async () => {
    redisEval.mockResolvedValue(0);

    await expect(
      verifyOtp('seller@example.com', '123456')
    ).resolves.toBeUndefined();

    expect(redisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('DEL', KEYS[1], KEYS[2])"),
      3,
      'otp:seller@example.com',
      'otp_attempts:seller@example.com',
      'otp_lock:seller@example.com',
      '123456'
    );
  });

  it('tracks failed OTP guesses atomically and reports remaining attempts', async () => {
    redisEval.mockResolvedValue(1);

    await expect(verifyOtp('seller@example.com', '000000')).rejects.toThrow(
      'Incorrect OTP! 2 attempts left.'
    );

    expect(redisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[2])"),
      3,
      'otp:seller@example.com',
      'otp_attempts:seller@example.com',
      'otp_lock:seller@example.com',
      '000000'
    );
  });

  it('locks the OTP after the third failed attempt', async () => {
    redisEval.mockResolvedValue(-2);

    await expect(verifyOtp('seller@example.com', '000000')).rejects.toThrow(
      'Too many attempts!'
    );
  });

  it('rejects expired OTPs', async () => {
    redisEval.mockResolvedValue(-1);

    await expect(verifyOtp('seller@example.com', '123456')).rejects.toThrow(
      'Invalid or expired OTP!'
    );
  });

  it('atomically enforces the OTP request limit', async () => {
    redisEval.mockResolvedValue(0);

    await expect(trackOtpRequests('seller@example.com')).rejects.toThrow(
      'Too many requests!'
    );

    expect(redisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      2,
      'otp_requests_count:seller@example.com',
      'otp_spam_lock:seller@example.com'
    );
  });

  it('sends six-digit OTPs and stores them with a five-minute expiry', async () => {
    sendEmailMock.mockResolvedValue(true);
    redisSet.mockResolvedValue('OK');

    await sendOtp('Seller One', 'seller@example.com', 'activation-template');

    const storedOtp = redisSet.mock.calls[0]?.[1];
    expect(storedOtp).toMatch(/^\d{6}$/);
    expect(redisSet).toHaveBeenCalledWith(
      'otp:seller@example.com',
      storedOtp,
      'EX',
      300
    );
  });

  it('uses the same accepted response for known and unknown reset emails', async () => {
    const unknownResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const knownResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    findUser
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-1',
        name: 'Customer',
      } as never);
    redisGet.mockResolvedValue(null);
    redisEval.mockResolvedValue(1);
    redisSet.mockResolvedValue('OK');
    sendEmailMock.mockResolvedValue(true);

    await handleForgotPassword(
      { body: { email: 'missing@example.com' } } as Request,
      unknownResponse,
      next,
      'user'
    );
    await handleForgotPassword(
      { body: { email: 'customer@example.com' } } as Request,
      knownResponse,
      next,
      'user'
    );

    expect(unknownResponse.status).toHaveBeenCalledWith(202);
    expect(knownResponse.status).toHaveBeenCalledWith(202);
    const responseBody = {
      message: 'If an account exists, password reset instructions will be sent.',
    };
    expect(unknownResponse.json).toHaveBeenCalledWith(responseBody);
    expect(knownResponse.json).toHaveBeenCalledWith(responseBody);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      'customer@example.com',
      'Verify your email',
      'forgot-password-user-mail',
      expect.objectContaining({ name: 'Customer', otp: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('sets an opaque short-lived HttpOnly reset cookie after OTP verification', async () => {
    const response = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;
    redisEval.mockResolvedValue(0);
    redisSet.mockResolvedValue('OK');
    findUser.mockResolvedValue({
      id: 'user-1',
      name: 'Customer',
    } as never);

    await verifyForgotPasswordOtp(
      {
        body: { email: 'customer@example.com', otp: '123456' },
      } as Request,
      response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Code verified. You can now choose a new password.',
    });
    expect(next).not.toHaveBeenCalled();

    const [cookieName, token, options] = jest.mocked(response.cookie).mock
      .calls[0] ?? [];
    expect(cookieName).toBe(PASSWORD_RESET_COOKIE_NAME);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 300_000,
      path: PASSWORD_RESET_COOKIE_PATH,
    });
    expect(JSON.stringify(jest.mocked(response.json).mock.calls)).not.toContain(
      token as string
    );
    expect(redisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^password_reset:[a-f0-9]{64}$/),
      'user-1',
      'EX',
      300
    );
    expect(redisSet.mock.calls[0]?.[0]).not.toContain(token);
  });

  it('stores only a hash of the reset token and consumes the grant atomically', async () => {
    const token = 'opaque-reset-token';
    redisSet.mockResolvedValue('OK');
    redisGet.mockResolvedValue('user-1');
    redisEval.mockResolvedValue('user-1');

    await createPasswordResetGrant('user-1', token);
    await expect(getPasswordResetGrantUserId(token)).resolves.toBe('user-1');
    await expect(consumePasswordResetGrant(token, 'user-1')).resolves.toBe(
      'user-1'
    );

    expect(redisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^password_reset:[a-f0-9]{64}$/),
      'user-1',
      'EX',
      300
    );
    expect(redisSet.mock.calls[0]?.[0]).not.toContain(token);
    expect(redisEval).toHaveBeenLastCalledWith(
      expect.stringContaining("redis.call('DEL', KEYS[1])"),
      1,
      expect.stringMatching(/^password_reset:[a-f0-9]{64}$/),
      'user-1'
    );
  });
});
