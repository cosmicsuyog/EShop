import redis from 'Packages/libs/redis';
import { sendEmail } from './sendMail';
import { sendOtp, trackOtpRequests, verifyOtp } from './auth.helper';

jest.mock('Packages/libs/redis', () => ({
  __esModule: true,
  default: {
    eval: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('./sendMail', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@packages/libs/prisma', () => ({
  __esModule: true,
  default: {},
}));

describe('atomic OTP verification and request limits', () => {
  const redisEval = jest.mocked(redis.eval);
  const redisSet = jest.mocked(redis.set);
  const sendEmailMock = jest.mocked(sendEmail);

  beforeEach(() => {
    redisEval.mockReset();
    redisSet.mockReset();
    sendEmailMock.mockReset();
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
});
