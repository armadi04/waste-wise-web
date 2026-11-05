import { describe, expect, it, jest } from 'bun:test';
import { AuthController } from '../../../src/auth/auth.controller';

describe('AuthController mobile login', () => {
  it('starts native sessions with the mobile audience', async () => {
    const user = { id: 3, email: 'user@example.com' };
    const authService = {
      validateGoogleUser: jest.fn(() => Promise.resolve(user)),
      login: jest.fn(() =>
        Promise.resolve({
          accessToken: 'a',
          refreshToken: 'r',
          sessionExpiresAt: new Date(0),
        }),
      ),
    };
    const twoFactorService = { isEnabled: jest.fn(() => false) };
    const controller = new AuthController(
      authService as never,
      {} as never,
      {} as never,
      twoFactorService as never,
      { emit: jest.fn() } as never,
    );

    await controller.mobileGoogleLogin(
      { token: 'google-id-token' },
      '10.0.0.2',
      'WasteWise-Mobile/1.0.0 (Android 14; Xiaomi 23078RKD5C)',
    );

    expect(authService.login).toHaveBeenCalledWith(user, {
      context: {
        ipAddress: '10.0.0.2',
        userAgent: 'WasteWise-Mobile/1.0.0 (Android 14; Xiaomi 23078RKD5C)',
      },
      audience: 'mobile',
    });
  });
});
