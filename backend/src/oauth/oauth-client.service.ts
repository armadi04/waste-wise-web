import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BaseService } from '@/common/services/base.service';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { OAuthClient } from './entities/oauth-client.entity';
import { CreateOAuthClientDto } from './dto/create-oauth-client.dto';
import { UpdateOAuthClientDto } from './dto/update-oauth-client.dto';
import { TokenRequestDto } from './dto/token-request.dto';

/** Access-token lifetime for the client_credentials grant, in seconds. */
const CLIENT_TOKEN_TTL_SECONDS = 3600;

export interface IssuedClient {
  client: OAuthClient;
  /** Plaintext secret — shown once at creation and never stored or returned again. */
  clientSecret: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

/**
 * Manages OAuth2 clients (admin CRUD via {@link BaseService}) and issues access
 * tokens for the `client_credentials` grant. Secrets are stored as bcrypt
 * hashes; tokens are the same JWT format as user tokens but tagged
 * `tokenType: 'client'` with the granted scopes as permissions.
 */
@Injectable()
export class OAuthClientService extends BaseService<OAuthClient> {
  constructor(
    @InjectRepository(OAuthClient)
    private readonly clientRepository: Repository<OAuthClient>,
    private readonly jwtService: JwtService,
  ) {
    super(clientRepository, 'OAuthClient', ['name', 'clientId']);
  }

  /**
   * Creates a client with a generated id + secret. Returns the plaintext secret
   * once; only its bcrypt hash is persisted.
   *
   * `creatorPermissions` are the permissions of the admin making the call. A
   * client may only be granted scopes the creator themselves hold — otherwise
   * `oauth.clients.create` would be a grant-anything privilege escalation. A
   * superadmin passes `['*']` to bypass the subset check.
   */
  async createClient(
    dto: CreateOAuthClientDto,
    creatorPermissions: string[],
  ): Promise<IssuedClient> {
    const scopes = this.validateGrantableScopes(dto.scopes, creatorPermissions);

    const clientId = `client_${randomBytes(16).toString('hex')}`;
    const plainSecret = randomBytes(32).toString('hex');
    const clientSecret = await bcrypt.hash(plainSecret, 10);

    const client = await this.create({
      clientId,
      clientSecret,
      name: dto.name,
      scopes,
      isActive: true,
    });

    return { client, clientSecret: plainSecret };
  }

  /**
   * Updates a client. Scopes it doesn't already have go through the same
   * "only grant what you hold" check as creation, so `oauth.clients.update`
   * can't widen a client past the editor's own access; scopes already granted
   * (e.g. by a superadmin) may stay or be removed.
   */
  async updateClient(
    id: number,
    dto: UpdateOAuthClientDto,
    editorPermissions: string[],
  ): Promise<OAuthClient> {
    if (dto.scopes === undefined) return this.update(id, dto);
    const client = await this.findOne(id);
    const held = new Set([...editorPermissions, ...client.scopes]);
    const scopes = this.validateGrantableScopes(dto.scopes, [...held]);
    return this.update(id, { ...dto, scopes });
  }

  /**
   * Rejects scopes that contain a comma (the `simple-array` column delimiter,
   * which would silently corrupt storage) and scopes the creator does not hold.
   */
  private validateGrantableScopes(
    scopes: string[],
    creatorPermissions: string[],
  ): string[] {
    const cleaned = scopes.map((s) => s.trim()).filter(Boolean);

    const withComma = cleaned.filter((s) => s.includes(','));
    if (withComma.length > 0) {
      throw new BadRequestException(
        `Scopes must not contain commas: ${withComma.join(' ')}`,
      );
    }

    const isSuperadmin = creatorPermissions.includes('*');
    if (!isSuperadmin) {
      const notHeld = cleaned.filter((s) => !creatorPermissions.includes(s));
      if (notHeld.length > 0) {
        throw new ForbiddenException(
          `You cannot grant scope(s) you do not hold: ${notHeld.join(', ')}`,
        );
      }
    }

    return cleaned;
  }

  /**
   * Validates client credentials and issues a scoped access token. Requested
   * scopes must be a subset of the client's granted scopes; when omitted, all
   * of the client's scopes are granted.
   */
  async issueToken(dto: TokenRequestDto): Promise<TokenResponse> {
    const client = await this.clientRepository.findOne({
      where: { clientId: dto.client_id },
    });

    // Uniform error + a compare against a dummy hash keep the timing/response
    // identical whether the client id exists, so neither can be probed.
    const secretMatches = client
      ? await bcrypt.compare(dto.client_secret, client.clientSecret)
      : await bcrypt.compare(dto.client_secret, DUMMY_HASH);

    if (!client || !client.isActive || !secretMatches) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    const grantedScopes = this.resolveScopes(dto.scope, client.scopes);

    const payload: JwtPayload = {
      sub: client.id,
      email: client.clientId,
      roles: [],
      permissions: grantedScopes,
      emailVerified: true,
      tokenType: 'client',
      client_id: client.clientId,
      scopes: grantedScopes,
    };

    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: CLIENT_TOKEN_TTL_SECONDS,
      }),
      token_type: 'Bearer',
      expires_in: CLIENT_TOKEN_TTL_SECONDS,
      scope: grantedScopes.join(' '),
    };
  }

  /**
   * Returns the client's current granted scopes if it is active, else null.
   * Used by the JWT strategy to re-derive a client token's effective scopes on
   * every request, so scope reductions (or deactivation) take effect
   * immediately rather than lingering until the token's TTL expires.
   */
  async getActiveClientScopes(clientId: string): Promise<string[] | null> {
    const client = await this.clientRepository.findOne({
      where: { clientId },
    });
    if (!client || !client.isActive) return null;
    return client.scopes;
  }

  private resolveScopes(
    requested: string | undefined,
    granted: string[],
  ): string[] {
    if (!requested) {
      return granted;
    }
    const requestedScopes = requested.split(' ').filter(Boolean);
    const invalid = requestedScopes.filter((s) => !granted.includes(s));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Requested scope(s) not granted to this client: ${invalid.join(', ')}`,
      );
    }
    return requestedScopes;
  }
}

/**
 * A valid bcrypt hash of a throwaway value, compared against when the client id
 * is unknown so credential checks take constant time regardless of existence.
 */
const DUMMY_HASH = bcrypt.hashSync('unknown-client-placeholder', 10);
