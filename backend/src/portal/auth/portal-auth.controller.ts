import { ClearCacheOnWrite } from '@/common/cache/clear-cache-on-write.interceptor';
import { sessionCookieMaxAge } from '@/auth/session-cookies';
import type { SessionTokens } from '@/auth/auth.service';
import {
  Body,
  Controller,
  Headers,
  Ip,
  Post,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import crypto from 'node:crypto';
import type { Request as ExpressRequest, Response } from 'express';
import { CookieCsrfGuard } from '@/auth/cookie-csrf.guard';
import {
  EmailOtpRequestDto,
  EmailOtpVerifyDto,
} from '@/portal/auth/dto/email-otp.dto';
import { PortalGoogleTokenDto } from '@/portal/auth/dto/google-token.dto';
import { PortalAuthService } from '@/portal/auth/portal-auth.service';
import { Throttle } from '@nestjs/throttler';
import { TurnstileService } from '@/auth/turnstile.service';

type PortalCookies = {
  accessToken?: string;
  refreshToken?: string;
};

@ApiTags('KuponMalam Portal Auth')
@Controller('portal/auth')
// Customer actions show up in the cached admin lists (orders, vouchers, reviews…).
@UseInterceptors(ClearCacheOnWrite('*/portal/admin*'))
export class PortalAuthController {
  private readonly isProd = process.env.NODE_ENV === 'production';

  constructor(
    private readonly portalAuthService: PortalAuthService,
    private readonly turnstileService: TurnstileService,
  ) {}

  @Post('email/request')
  @ApiResponse({
    status: 201,
    description: 'OTP request accepted',
    schema: {
      type: 'object',
      required: ['message', 'expiresInSeconds'],
      properties: {
        message: { type: 'string' },
        expiresInSeconds: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid security challenge' })
  @ApiResponse({
    status: 503,
    description: 'Security verification unavailable',
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async requestEmailOtp(@Body() dto: EmailOtpRequestDto, @Ip() ip: string) {
    await this.turnstileService.verify(
      dto.turnstileToken ?? '',
      ip,
      'portal-email-otp',
    );
    return this.portalAuthService.requestEmailOtp(dto.email, ip);
  }

  @Post('email/verify')
  async verifyEmailOtp(
    @Body() dto: EmailOtpVerifyDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.portalAuthService.verifyEmailOtp(
      dto.email,
      dto.code,
      {
        ipAddress: ip,
        userAgent,
      },
    );
    this.setSessionCookies(response, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('google')
  async loginWithGoogle(
    @Body() dto: PortalGoogleTokenDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.portalAuthService.loginWithGoogle(dto.token, {
      ipAddress: ip,
      userAgent,
    });
    this.setSessionCookies(response, tokens);
    return { accessToken: tokens.accessToken };
  }

  // No JWT guard: an expired access token must still be able to sign out, or
  // the refresh cookie would silently restore the session afterwards. The CSRF
  // guard keeps this cookie-authenticated write same-site.
  @ApiBearerAuth()
  @UseGuards(CookieCsrfGuard)
  @Post('logout')
  async logout(
    @Request() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as PortalCookies | undefined;
    const accessToken =
      request.headers.authorization?.split(' ')[1] ?? cookies?.accessToken;
    await this.portalAuthService.logout(accessToken, cookies?.refreshToken);
    response.clearCookie('refreshToken');
    response.clearCookie('accessToken', { path: '/' });
    response.clearCookie('authenticated', { path: '/' });
    response.clearCookie('csrfToken', { path: '/' });
    return { message: 'Logout successful' };
  }

  private setSessionCookies(response: Response, tokens: SessionTokens) {
    const maxAge = sessionCookieMaxAge(tokens.sessionExpiresAt);
    response.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    response.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      maxAge,
    });
    response.cookie('authenticated', '1', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    response.cookie('csrfToken', crypto.randomBytes(16).toString('hex'), {
      httpOnly: false,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
  }
}
