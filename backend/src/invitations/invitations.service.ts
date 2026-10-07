import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Invitation } from './entities/invitation.entity';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { BaseService } from '../common/services/base.service';
import { RegisterMethodEnum } from '@/users/register-method.enum';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { GrantPolicyService } from '../roles/grant-policy.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth-request.interface';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class InvitationsService extends BaseService<Invitation> {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationsRepository: Repository<Invitation>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly grantPolicy: GrantPolicyService,
  ) {
    super(invitationsRepository, 'Invitation', ['email']);
  }

  private buildInviteUrl(token: string): string {
    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    return `${appUrl}/accept-invite?token=${token}`;
  }

  async createInvite(
    dto: CreateInvitationDto,
    inviter: AuthenticatedUser,
  ): Promise<{ invitation: Invitation; inviteUrl: string }> {
    // The roles take effect on acceptance, so an invite must not carry more
    // access than the inviter could grant directly.
    if (dto.roleIds?.length) {
      await this.grantPolicy.assertCanGrantRoles(inviter, dto.roleIds);
    }
    const existingUser = await this.usersService.findOneByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    // Drop any previous pending invite for this email
    await this.invitationsRepository.softDelete({
      email: dto.email,
      acceptedAt: IsNull(),
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const invitation = await this.invitationsRepository.save(
      this.invitationsRepository.create({
        token,
        email: dto.email.trim().toLowerCase(),
        roleIds: dto.roleIds ?? null,
        invitedBy: inviter.userId,
        expiresAt,
      }),
    );

    const inviteUrl = this.buildInviteUrl(token);
    await this.mailService.sendInvitationEmail(dto.email, inviteUrl);

    this.eventEmitter.emit('user.invited', {
      email: invitation.email,
      invitedBy: inviter.userId,
    });

    return { invitation, inviteUrl };
  }

  async getByToken(token: string): Promise<{ email: string }> {
    const invitation = await this.validateToken(token);
    return { email: invitation.email };
  }

  async acceptInvite(dto: AcceptInvitationDto): Promise<{ message: string }> {
    const invitation = await this.validateToken(dto.token);

    await this.usersService.create(
      {
        email: invitation.email,
        password: dto.password,
        fullname: dto.fullname,
        phone: dto.phone,
        roleIds: invitation.roleIds ?? undefined,
      },
      { autoVerify: true, registerMethod: RegisterMethodEnum.INVITATION },
    );

    invitation.acceptedAt = new Date();
    await this.invitationsRepository.save(invitation);

    return { message: 'Your account has been created. You can now log in.' };
  }

  async resend(id: number): Promise<Invitation> {
    const invitation = await this.findOne(id);
    if (invitation.acceptedAt) {
      throw new BadRequestException(
        'This invitation has already been accepted.',
      );
    }

    invitation.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const saved = await this.invitationsRepository.save(invitation);

    await this.mailService.sendInvitationEmail(
      saved.email,
      this.buildInviteUrl(saved.token),
    );

    return saved;
  }

  async revoke(id: number): Promise<void> {
    const invitation = await this.findOne(id);
    await this.invitationsRepository.softRemove(invitation);
  }

  async revokeMany(ids: number[]): Promise<{ deleted: number }> {
    const invitations = await this.invitationsRepository.find({
      where: { id: In(ids) },
    });
    if (invitations.length) {
      await this.invitationsRepository.softRemove(invitations);
    }
    return { deleted: invitations.length };
  }

  private async validateToken(token: string): Promise<Invitation> {
    const INVALID_MSG = 'This invitation link is invalid or has expired.';

    const invitation = await this.invitationsRepository.findOneBy({ token });
    if (!invitation) throw new BadRequestException(INVALID_MSG);
    if (invitation.acceptedAt) throw new BadRequestException(INVALID_MSG);
    if (invitation.expiresAt < new Date())
      throw new BadRequestException(INVALID_MSG);

    return invitation;
  }
}
