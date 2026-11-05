import type { NextFunction, Request, Response } from 'express';
import prisma from '@packages/libs/prisma/index.js';
import { ForbiddenError, ValidationError } from '@packages/error-handler/index';
import bcrypt from 'bcryptjs';
import {
  consumePasswordResetGrant,
  getPasswordResetGrantUserId,
  PASSWORD_RESET_COOKIE_NAME,
  PASSWORD_RESET_COOKIE_PATH,
} from '../utils/auth.helper';
import { resetUserPassword } from './auth.controller';

jest.mock('@packages/libs/prisma/index.js', () => ({
  __esModule: true,
  default: {
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    compare: jest.fn(),
    hash: jest.fn(),
  },
}));

jest.mock('../utils/auth.helper', () => ({
  __esModule: true,
  checkOtpRestrictions: jest.fn(),
  consumePasswordResetGrant: jest.fn(),
  getPasswordResetGrantUserId: jest.fn(),
  handleForgotPassword: jest.fn(),
  PASSWORD_RESET_COOKIE_NAME: 'passwordResetToken',
  PASSWORD_RESET_COOKIE_PATH: '/api/reset-password-user',
  sendOtp: jest.fn(),
  trackOtpRequests: jest.fn(),
  validationRegistrationData: jest.fn(),
  verifyForgotPasswordOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));

describe('customer password reset authorization', () => {
  const findUser = jest.mocked(prisma.users.findUnique);
  const updateUser = jest.mocked(prisma.users.update);
  const comparePassword = jest.mocked(bcrypt.compare);
  const hashPassword = jest.mocked(bcrypt.hash);
  const getGrantUserId = jest.mocked(getPasswordResetGrantUserId);
  const consumeGrant = jest.mocked(consumePasswordResetGrant);

  const makeResponse = () => {
    const response = {
      clearCookie: jest.fn(),
      json: jest.fn(),
      status: jest.fn(),
    };
    response.status.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({
      id: 'reset-authorized-user',
      email: 'customer@example.com',
      password: 'old-hash',
    } as never);
    comparePassword.mockResolvedValue(false);
    hashPassword.mockResolvedValue('new-hash');
    getGrantUserId.mockResolvedValue('reset-authorized-user');
    consumeGrant.mockResolvedValue('reset-authorized-user');
    updateUser.mockResolvedValue({} as never);
  });

  it('uses the HttpOnly grant instead of a caller-supplied email to select the account', async () => {
    const response = makeResponse();
    const next = jest.fn() as NextFunction;
    const token = 'opaque-reset-cookie-token';
    const request = {
      body: { email: 'attacker@example.com', newPassword: 'new password' },
      cookies: { [PASSWORD_RESET_COOKIE_NAME]: token },
      get: () => 'http://localhost:3000',
    } as unknown as Request;

    await resetUserPassword(request, response as unknown as Response, next);

    expect(getGrantUserId).toHaveBeenCalledWith(token);
    expect(findUser).toHaveBeenCalledWith({
      where: { id: 'reset-authorized-user' },
    });
    expect(consumeGrant).toHaveBeenCalledWith(
      token,
      'reset-authorized-user'
    );
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'reset-authorized-user' },
      data: { password: 'new-hash' },
    });
    expect(response.clearCookie).toHaveBeenCalledWith(
      PASSWORD_RESET_COOKIE_NAME,
      expect.objectContaining({ path: PASSWORD_RESET_COOKIE_PATH })
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Password reset successfully.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a reset without the HttpOnly grant', async () => {
    const response = makeResponse();
    const next = jest.fn() as NextFunction;

    await resetUserPassword(
      {
        body: { newPassword: 'new password' },
        cookies: {},
        get: () => 'http://localhost:3000',
      } as unknown as Request,
      response as unknown as Response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(getGrantUserId).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('rejects cross-origin reset requests before consuming the grant', async () => {
    const response = makeResponse();
    const next = jest.fn() as NextFunction;

    await resetUserPassword(
      {
        body: { newPassword: 'new password' },
        cookies: { [PASSWORD_RESET_COOKIE_NAME]: 'reset-token' },
        get: () => 'https://attacker.example',
      } as unknown as Request,
      response as unknown as Response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(getGrantUserId).not.toHaveBeenCalled();
    expect(consumeGrant).not.toHaveBeenCalled();
  });

  it('rejects a grant that was already consumed by another reset request', async () => {
    const response = makeResponse();
    const next = jest.fn() as NextFunction;
    consumeGrant.mockResolvedValue(null);

    await resetUserPassword(
      {
        body: { newPassword: 'new password' },
        cookies: { [PASSWORD_RESET_COOKIE_NAME]: 'reset-token' },
        get: () => 'http://localhost:3000',
      } as unknown as Request,
      response as unknown as Response,
      next
    );

    expect(updateUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });
});
