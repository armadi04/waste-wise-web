import { RequireSessionCsrf } from './session-csrf.guard';
import { setSessionCookie } from '@/auth/session-cookies';
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Header,
  HttpCode,
  Headers,
  Ip,
  Param,
  Query,
  UnauthorizedException,
  NotFoundException,
  ClassSerializerInterceptor,
  Res,
} from '@nestjs/common';
import crypto from 'crypto';
import type { FastifyReply as Response } from 'fastify';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService, type SessionTokens } from './auth.service';
import { sessionCookieMaxAge } from './session-cookies';
import { TurnstileService } from './turnstile.service';
import { LoginDto } from './dto/login.dto';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { MobileAuthSessionDto } from './dto/mobile-auth-session.dto';
import { MobileRefreshTokenDto } from './dto/mobile-refresh.dto';
import { MobileTwoFactorChallengeDto } from './dto/mobile-two-factor-challenge.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import type { IAuthRequest } from './interfaces/auth-request.interface';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { Permissions } from './permissions.decorator';
import { Throttle } from '@nestjs/throttler';

import { NoFilesInterceptor } from '@nestjs/platform-fastify/multipart';
import { UseInterceptors } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { SessionsService } from '../sessions/sessions.service';
import { TwoFactorService } from './two-factor.service';
import {
  MessageResponseDto,
  RecoveryCodesDto,
  TwoFactorEnrollmentDto,
  TwoFactorStatusDto,
} from './dto/two-factor-management.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';

@ApiTags('Auth')
@ApiExtraModels(MobileAuthSessionDto, MobileTwoFactorChallengeDto)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly turnstileService: TurnstileService,
    private readonly sessionsService: SessionsService,
    private readonly twoFactorService: TwoFactorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private readonly isProd = process.env.NODE_ENV === 'production';

  /**
   * Sets the session cookies for a browser client:
   * - `accessToken`: httpOnly so page JS can never read it (XSS-safe); the JWT
   *   strategy authenticates browser requests from this cookie.
   * - `authenticated`: a non-sensitive, JS-readable flag (no token payload) so
   *   the SPA can synchronously know it is logged in for route guards.
   * The access token is still returned in the response body for non-browser
   * clients (mobile / third-party) that authenticate via the Authorization header.
   */
  private setSessionCookies(
    res: Response,
    accessToken: string,
    maxAge: number,
  ) {
    setSessionCookie(res, 'accessToken', accessToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    setSessionCookie(res, 'authenticated', '1', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
  }

  private setRefreshCookie(
    res: Response,
    refreshToken: string,
    maxAge: number,
  ) {
    setSessionCookie(res, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      maxAge,
    });
  }

  // Refresh keeps the current value (open tabs keep working) but renews its
  // lifetime with the session; otherwise writes fail once the cookie expires.
  private setCsrfCookie(res: Response, maxAge: number, current?: string) {
    const csrfToken =
      current && /^[a-f0-9]{32}$/.test(current)
        ? current
        : crypto.randomBytes(16).toString('hex');
    setSessionCookie(res, 'csrfToken', csrfToken, {
      httpOnly: false,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
  }

  /** All browser session cookies, sized to the session's absolute deadline. */
  private setTokenCookies(
    res: Response,
    tokens: SessionTokens,
    currentCsrf?: string,
  ) {
    const maxAge = sessionCookieMaxAge(tokens.sessionExpiresAt);
    this.setRefreshCookie(res, tokens.refreshToken, maxAge);
    this.setSessionCookies(res, tokens.accessToken, maxAge);
    this.setCsrfCookie(res, maxAge, currentCsrf);
  }

  /**
   * Finish a login: open the device session, set the cookies, hand the access
   * token back for non-browser clients. Shared by password, Google and
   * two-factor verification so all three end a login identically.
   */
  private async completeLogin(
    user: Omit<User, 'password'>,
    res: Response,
    context: { ipAddress: string; userAgent: string },
  ) {
    const tokens = await this.authService.login(user, { context });
    this.eventEmitter.emit('audit.record', {
      action: 'auth.login',
      actorId: user.id,
      actorEmail: user.email,
      subjectType: 'user',
      subjectId: user.id,
      summary: 'Signed in',
      ipAddress: context.ipAddress,
    });
    this.setTokenCookies(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  /**
   * Native clients cannot use the browser's CSRF-cookie flow. They receive the
   * refresh token directly over HTTPS and spend it at the mobile refresh
   * endpoint, which also lets logout revoke the device session without cookies.
   */
  private async completeMobileLogin(
    user: Omit<User, 'password'>,
    context: { ipAddress: string; userAgent: string },
  ) {
    const tokens = await this.authService.login(user, {
      context,
      audience: 'mobile',
    });
    this.eventEmitter.emit('audit.record', {
      action: 'auth.login',
      actorId: user.id,
      actorEmail: user.email,
      subjectType: 'user',
      subjectId: user.id,
      summary: 'Signed in from mobile',
      ipAddress: context.ipAddress,
    });
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionExpiresAt: tokens.sessionExpiresAt,
    };
  }

  /**
   * Spend a two-factor challenge and return the verified user. Browser and
   * mobile routes share this; only the final token delivery differs.
   */
  private async verifyTwoFactorChallenge(
    dto: TwoFactorVerifyDto,
  ): Promise<Omit<User, 'password'>> {
    const userId = this.authService.consumeTwoFactorChallenge(
      dto.challengeToken,
    );

    const user = await this.authService.getProfile(userId);
    if (!user) throw new UnauthorizedException('User no longer exists');

    // A wrong code is a guess at the same account as a wrong password, so it
    // counts towards the same lockout.
    this.authService.assertNotLocked(user);
    if (!(await this.twoFactorService.verify(userId, dto.code))) {
      await this.authService.registerFailedLogin(user);
      throw new UnauthorizedException({
        message: 'That code is not valid',
        code: 'TWO_FACTOR_INVALID_CODE',
      });
    }
    await this.authService.clearFailedLogins(user);
    return user;
  }

  @Post('login')
  @ApiResponse({ status: 400, description: 'Invalid security challenge' })
  @ApiResponse({
    status: 503,
    description: 'Security verification unavailable',
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.turnstileService.verify(
      loginDto.turnstileToken ?? '',
      ip,
      'admin-login',
    );

    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      this.eventEmitter.emit('audit.record', {
        action: 'auth.login_failed',
        actorEmail: loginDto.email,
        summary: `Failed sign-in for ${loginDto.email}`,
        ipAddress: ip,
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    // With a second factor enabled the password alone isn't a session — hand
    // back a challenge the client must spend at /auth/2fa/verify.
    if (this.twoFactorService.isEnabled(user)) {
      return {
        twoFactorRequired: true,
        challengeToken: this.authService.issueTwoFactorChallenge(user),
      };
    }

    return this.completeLogin(user, res, { ipAddress: ip, userAgent });
  }

  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with Google' })
  @ApiResponse({
    status: 200,
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // If it's a standard Google access token, validate it with the access token method
    const user = googleLoginDto.token.startsWith('ya29.')
      ? await this.authService.validateGoogleAccessToken(googleLoginDto.token)
      : await this.authService.validateGoogleUser(googleLoginDto.token);

    if (this.twoFactorService.isEnabled(user)) {
      return {
        twoFactorRequired: true,
        challengeToken: this.authService.issueTwoFactorChallenge(user),
      };
    }

    return this.completeLogin(user, res, { ipAddress: ip, userAgent });
  }

  @Post('mobile/google')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with Google for a native mobile client' })
  @ApiResponse({
    status: 200,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(MobileAuthSessionDto) },
        { $ref: getSchemaPath(MobileTwoFactorChallengeDto) },
      ],
    },
  })
  @UseInterceptors(NoFilesInterceptor())
  async mobileGoogleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const user = googleLoginDto.token.startsWith('ya29.')
      ? await this.authService.validateGoogleAccessToken(googleLoginDto.token)
      : await this.authService.validateGoogleUser(googleLoginDto.token);

    if (this.twoFactorService.isEnabled(user)) {
      return {
        twoFactorRequired: true,
        challengeToken: this.authService.issueTwoFactorChallenge(user),
      };
    }

    return this.completeMobileLogin(user, {
      ipAddress: ip,
      userAgent: userAgent || 'WasteWise-Mobile',
    });
  }

  @Post('mobile/2fa/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Finish a mobile login with two-factor verification',
  })
  @ApiResponse({
    status: 200,
    type: MobileAuthSessionDto,
  })
  @UseInterceptors(NoFilesInterceptor())
  async mobileVerifyTwoFactor(
    @Body() dto: TwoFactorVerifyDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const user = await this.verifyTwoFactorChallenge(dto);
    return this.completeMobileLogin(user, {
      ipAddress: ip,
      userAgent: userAgent || 'WasteWise-Mobile',
    });
  }

  @Post('mobile/refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate a mobile refresh token' })
  @ApiResponse({
    status: 200,
    type: MobileAuthSessionDto,
  })
  @UseInterceptors(NoFilesInterceptor())
  async mobileRefresh(
    @Body() dto: MobileRefreshTokenDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const tokens = await this.authService.refresh(dto.refreshToken, {
      ipAddress: ip,
      userAgent: userAgent || 'WasteWise-Mobile',
    });
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionExpiresAt: tokens.sessionExpiresAt,
    };
  }

  @Post('mobile/logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Revoke a mobile refresh token and device session' })
  @ApiResponse({
    status: 200,
    schema: { properties: { message: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async mobileLogout(
    @Body() dto: MobileRefreshTokenDto,
    @Headers('authorization') authorization?: string,
  ) {
    const accessToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (accessToken) {
      await this.authService.blacklistToken(accessToken);
    }

    const session = this.authService.sessionFromTokens([dto.refreshToken]);
    await this.authService.blacklistToken(dto.refreshToken);
    if (session?.sessionId) {
      await this.sessionsService.revokeBySessionId(session.sessionId);
    }

    this.eventEmitter.emit('audit.record', {
      action: 'auth.logout',
      actorId: session?.userId,
      actorEmail: session?.email,
      summary: 'Signed out from mobile',
    });
    return { message: 'Logout successful' };
  }

  @Post('2fa/verify')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Finish a login by verifying the second factor' })
  @ApiResponse({
    status: 201,
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async verifyTwoFactor(
    @Body() dto: TwoFactorVerifyDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.verifyTwoFactorChallenge(dto);
    return this.completeLogin(user, res, { ipAddress: ip, userAgent });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('2fa')
  @ApiOperation({ summary: 'Two-factor status for the current user' })
  @ApiResponse({ status: 200, type: TwoFactorStatusDto })
  async twoFactorStatus(@Request() req: IAuthRequest) {
    const user = await this.authService.getProfile(req.user.userId);
    return {
      enabled: !!user?.twoFactorEnabledAt,
      recoveryCodesRemaining:
        await this.twoFactorService.countUnusedRecoveryCodes(req.user.userId),
    };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/setup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start two-factor enrollment (QR + secret)' })
  @ApiResponse({ status: 201, type: TwoFactorEnrollmentDto })
  startTwoFactorSetup(@Request() req: IAuthRequest) {
    return this.twoFactorService.startEnrollment(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/enable')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirm enrollment; returns the recovery codes' })
  @ApiResponse({ status: 201, type: RecoveryCodesDto })
  @UseInterceptors(NoFilesInterceptor())
  async enableTwoFactor(
    @Request() req: IAuthRequest,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return {
      recoveryCodes: await this.twoFactorService.confirm(
        req.user.userId,
        dto.code,
      ),
    };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/disable')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Turn the second factor off (needs a valid code)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  @UseInterceptors(NoFilesInterceptor())
  async disableTwoFactor(
    @Request() req: IAuthRequest,
    @Body() dto: TwoFactorCodeDto,
  ) {
    await this.twoFactorService.disable(req.user.userId, dto.code);
    return { message: 'Two-factor authentication disabled' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/recovery-codes')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Replace the recovery codes (needs a valid code)' })
  @ApiResponse({ status: 201, type: RecoveryCodesDto })
  @UseInterceptors(NoFilesInterceptor())
  async regenerateRecoveryCodes(
    @Request() req: IAuthRequest,
    @Body() dto: TwoFactorCodeDto,
  ) {
    if (!(await this.twoFactorService.verify(req.user.userId, dto.code))) {
      throw new UnauthorizedException('That code is not valid');
    }
    return {
      recoveryCodes: await this.twoFactorService.replaceRecoveryCodes(
        req.user.userId,
      ),
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('users.impersonate')
  @Post('impersonate/:id')
  @ApiOperation({ summary: 'Open a session as another user' })
  @ApiResponse({
    status: 201,
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  async impersonate(
    @Request() req: IAuthRequest,
    @Param('id') id: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.impersonate(req.user, +id, {
      ipAddress: ip,
      userAgent,
    });
    // The administrator's own session ends here — they get it back by stopping
    // the impersonation, which mints a fresh one.
    if (req.user.sessionId) {
      await this.sessionsService.revokeBySessionId(req.user.sessionId);
    }
    this.setTokenCookies(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('stop-impersonating')
  @ApiOperation({ summary: 'Return to your own account' })
  @ApiResponse({
    status: 201,
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  async stopImpersonating(
    @Request() req: IAuthRequest,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.stopImpersonating(req.user, {
      ipAddress: ip,
      userAgent,
    });
    if (req.user.sessionId) {
      await this.sessionsService.revokeBySessionId(req.user.sessionId);
    }
    this.setTokenCookies(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @RequireSessionCsrf()
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({
    status: 200,
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  async refresh(
    @Request() req: IAuthRequest,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string | undefined>)[
      'refreshToken'
    ];
    if (!refreshToken)
      throw new UnauthorizedException('Refresh token not found');

    const tokens = await this.authService.refresh(refreshToken, {
      ipAddress: ip,
      userAgent,
    });
    this.setTokenCookies(
      res,
      tokens,
      (req.cookies as Record<string, string | undefined>).csrfToken,
    );
    return { accessToken: tokens.accessToken };
  }

  @ApiBearerAuth()
  @RequireSessionCsrf()
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @ApiOperation({ summary: 'Logout and clear refresh token cookie' })
  @ApiResponse({
    status: 200,
    schema: { properties: { message: { type: 'string' } } },
  })
  async logout(
    @Request() req: IAuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (token) {
      await this.authService.blacklistToken(token);
    }
    // Also blacklist the refresh token so a captured one can't mint new tokens
    // after logout (it stays valid for its full TTL otherwise).
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.blacklistToken(refreshToken);
    }
    // End the device session too, so it disappears from the user's session list
    // and any other token minted for it stops working.
    if (req.user.sessionId) {
      await this.sessionsService.revokeBySessionId(req.user.sessionId);
    }
    this.eventEmitter.emit('audit.record', {
      action: 'auth.logout',
      actorId: req.user.userId,
      actorEmail: req.user.email,
      summary: 'Signed out',
    });
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('authenticated', { path: '/' });
    res.clearCookie('csrfToken', { path: '/' });
    return { message: 'Logout successful' };
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({
    status: 200,
    schema: { properties: { message: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({
    status: 200,
    schema: { properties: { message: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({
    status: 200,
    schema: { properties: { message: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async resendVerification(@Body() dto: ResendVerificationDto) {
    const user = await this.authService.findUserByEmailForVerification(
      dto.email,
    );
    if (!user || user.emailVerifiedAt) {
      return {
        message:
          'If your email is registered and unverified, a new link has been sent.',
      };
    }
    await this.authService.sendVerificationEmail(user.id, user.email);
    return {
      message:
        'If your email is registered and unverified, a new link has been sent.',
    };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address using token from email' })
  @ApiResponse({
    status: 200,
    schema: { properties: { message: { type: 'string' } } },
  })
  async verifyEmail(@Query('token') token: string) {
    if (!token) throw new NotFoundException('Token not provided');
    return this.authService.verifyEmail(token);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(ClassSerializerInterceptor)
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: User })
  getProfile(@Request() req: IAuthRequest) {
    return this.authService.getProfile(req.user.userId);
  }

  @ApiBearerAuth()
  @RequireSessionCsrf()
  @UseGuards(AuthGuard('jwt'))
  @Post('switch-role')
  @ApiOperation({ summary: 'Re-issue tokens scoped to a role the user holds' })
  @ApiResponse({
    status: 201,
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async switchRole(
    @Request() req: IAuthRequest,
    @Body() dto: SwitchRoleDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.switchRole(
      req.user.userId,
      dto.role,
      req.user.sessionId,
      req.user.impersonatorId,
    );
    this.setTokenCookies(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({
    summary: 'Current session identity (flattened roles + permissions)',
  })
  @ApiResponse({
    status: 200,
    schema: {
      properties: {
        userId: { type: 'number' },
        email: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' } },
        permissions: { type: 'array', items: { type: 'string' } },
        emailVerified: { type: 'boolean' },
        activeRole: { type: 'string' },
      },
    },
  })
  me(@Request() req: IAuthRequest) {
    // Returns exactly what the JWT strategy resolved (flattened role +
    // direct permissions), so the SPA gets identity without reading the token.
    return req.user;
  }
}
