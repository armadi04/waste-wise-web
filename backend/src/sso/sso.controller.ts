import { setSessionCookie } from '@/auth/session-cookies';
import { API_BASE_PATH } from '@/config/api-routing';
import { sessionCookieMaxAge } from '@/auth/session-cookies';
import type { SessionTokens } from '@/auth/auth.service';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import type {
  FastifyRequest as Request,
  FastifyReply as Response,
} from 'fastify';
import { SsoService } from './sso.service';
import { AuthService } from '../auth/auth.service';

const isProd = () => process.env.NODE_ENV === 'production';
const SSO_COOKIE_PATH = `${API_BASE_PATH}/auth/sso`;

/**
 * Why an SSO browser navigation failed. Sent to the SPA as `?ssoError=` so the
 * login page can explain it; every value has a matching copy block there.
 */
export type SsoErrorCode =
  'not_configured' | 'session_expired' | 'exchange_failed';

@ApiExcludeController()
@Controller('auth/sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    private readonly sso: SsoService,
    private readonly authService: AuthService,
    private readonly env: ConfigService,
  ) {}

  // Kick off the OIDC authorization-code + PKCE flow (interactive login).
  @Get('login')
  async login(@Res() res: Response): Promise<void> {
    await this.beginAuth(res);
  }

  // Every route below is reached by a full-page browser navigation, so a thrown
  // HttpException would render raw JSON in the address bar. Bounce back to the
  // SPA's login page with a code it can explain instead.
  private redirectWithError(res: Response, code: SsoErrorCode): void {
    const base = this.env.get<string>('SSO_POST_LOGOUT_URI') ?? '';
    res.redirect(`${base}/login?ssoError=${code}`, 302);
  }

  // Silent login: attempt authorization with `prompt=none`. If an IdP session
  // exists the user is logged in with no interaction; otherwise the IdP returns
  // `login_required` and the callback falls back to the logged-out page. A
  // one-shot `ssoSilent` cookie lets the SPA avoid retrying in a loop.
  @Get('silent')
  async silentLogin(@Res() res: Response): Promise<void> {
    setSessionCookie(res, 'ssoSilent', '1', {
      httpOnly: false, // the SPA reads this to gate its one-shot attempt
      secure: isProd(),
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
    await this.beginAuth(res, 'none');
  }

  // IdP redirects the browser back here with ?code & ?state, or ?error on a
  // failed silent attempt (login_required / interaction_required).
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Rebuild the exact registered redirect URI + the incoming query string.
    const redirectUri = this.env.getOrThrow<string>('SSO_REDIRECT_URI');
    const currentUrl = new URL(redirectUri);
    const qIndex = req.url.indexOf('?');
    currentUrl.search = qIndex >= 0 ? req.url.slice(qIndex) : '';

    // A silent attempt with no active IdP session comes back as an error — fall
    // back to the logged-out page rather than throwing. The one-shot cookie
    // stays set so the SPA shows the login form instead of looping.
    if (currentUrl.searchParams.has('error')) {
      // Keep `ssoSilent` set so the SPA renders the login form, not a loop.
      this.clearPkce(res);
      res.redirect(this.env.get<string>('SSO_POST_LOGOUT_URI') ?? '/', 302);
      return;
    }

    const cookies = req.cookies as Record<string, string | undefined>;
    const verifier = cookies['ssoVerifier'];
    const state = cookies['ssoState'];
    if (!verifier || !state) {
      this.clearPkce(res);
      this.redirectWithError(res, 'session_expired');
      return;
    }

    let exchanged: Awaited<ReturnType<SsoService['exchange']>>;
    try {
      exchanged = await this.sso.exchange(currentUrl, verifier, state);
    } catch (err) {
      this.logger.error(
        'SSO code exchange failed',
        err instanceof Error ? err.stack : String(err),
      );
      this.clearPkce(res);
      this.redirectWithError(res, 'exchange_failed');
      return;
    }
    const { claims, idToken, sid } = exchanged;
    this.clearPkce(res);
    res.clearCookie('ssoSilent', { path: '/' }); // logged in — reset the guard

    const user = await this.sso.provisionUser(claims);
    const tokens = await this.authService.login(user, {
      sid,
      context: {
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
    this.setAuthCookies(res, tokens, idToken);

    res.redirect(this.env.get<string>('SSO_SUCCESS_REDIRECT') ?? '/', 302);
  }

  // Generate PKCE, stash verifier/state in short-lived cookies, redirect to the
  // IdP authorization endpoint (optionally silent via prompt=none).
  private async beginAuth(res: Response, prompt?: 'none'): Promise<void> {
    if (!this.sso.enabled) {
      this.redirectWithError(res, 'not_configured');
      return;
    }
    const { verifier, challenge, state } = await this.sso.newPkce();
    const transient = {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax' as const, // must survive the cross-site return from the IdP
      path: SSO_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    };
    setSessionCookie(res, 'ssoVerifier', verifier, transient);
    setSessionCookie(res, 'ssoState', state, transient);
    res.redirect(this.sso.buildAuthUrl(challenge, state, prompt).href, 302);
  }

  // Drop the per-attempt PKCE cookies.
  private clearPkce(res: Response): void {
    res.clearCookie('ssoVerifier', { path: SSO_COOKIE_PATH });
    res.clearCookie('ssoState', { path: SSO_COOKIE_PATH });
  }

  // RP-initiated logout: clear our session, then bounce through the IdP's
  // end-session endpoint so the IdP session ends too.
  @Get('logout')
  ssoLogout(@Req() req: Request, @Res() res: Response): void {
    const cookies = req.cookies as Record<string, string | undefined>;
    const idToken = cookies['ssoIdToken'];

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('authenticated', { path: '/' });
    res.clearCookie('refreshToken');
    res.clearCookie('csrfToken', { path: '/' });
    res.clearCookie('ssoIdToken', { path: SSO_COOKIE_PATH });

    if (this.sso.enabled && idToken) {
      res.redirect(this.sso.endSessionUrl(idToken).href, 302);
      return;
    }
    res.redirect(this.env.get<string>('SSO_POST_LOGOUT_URI') ?? '/', 302);
  }

  // Back-channel logout: the IdP POSTs a signed logout_token here on single
  // logout. Verify it and revoke the matching session app-wide.
  @Post('backchannel-logout')
  @HttpCode(200)
  async backchannelLogout(
    @Body() body: { logout_token?: string },
  ): Promise<Record<string, never>> {
    if (!body?.logout_token) {
      throw new BadRequestException('logout_token is required');
    }
    const { sid, sub } = await this.sso.verifyLogoutToken(body.logout_token);
    if (sid) {
      await this.authService.revokeSession(sid, sub);
    }
    return {};
  }

  // Mirrors the cookie pattern in auth.controller.ts: an httpOnly accessToken
  // (never exposed to page JS), a non-httpOnly `authenticated` flag so the SPA
  // knows it is logged in after the redirect (it then loads identity from
  // /auth/profile), and an httpOnly ssoIdToken kept as the end-session hint.
  // The redirect flow can't return the access token in a JSON body.
  private setAuthCookies(
    res: Response,
    tokens: SessionTokens,
    idToken: string,
  ): void {
    const maxAge = sessionCookieMaxAge(tokens.sessionExpiresAt);
    setSessionCookie(res, 'refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'strict',
      maxAge,
    });
    setSessionCookie(res, 'accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    setSessionCookie(res, 'authenticated', '1', {
      httpOnly: false,
      secure: isProd(),
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    setSessionCookie(res, 'csrfToken', crypto.randomBytes(16).toString('hex'), {
      httpOnly: false,
      secure: isProd(),
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    setSessionCookie(res, 'ssoIdToken', idToken, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: SSO_COOKIE_PATH,
      maxAge,
    });
  }
}
