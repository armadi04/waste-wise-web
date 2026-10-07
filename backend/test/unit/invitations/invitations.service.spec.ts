import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { InvitationsService } from '../../../src/invitations/invitations.service';
import { Invitation } from '../../../src/invitations/entities/invitation.entity';
import { UsersService } from '../../../src/users/users.service';
import { MailService } from '../../../src/mail/mail.service';
import { GrantPolicyService } from '../../../src/roles/grant-policy.service';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth-request.interface';

const inviter = {
  userId: 5,
  email: 'admin@b.com',
  roles: ['admin'],
  permissions: ['users.invite'],
  emailVerified: true,
} as AuthenticatedUser;

describe('InvitationsService', () => {
  let service: InvitationsService;
  let repository: {
    softDelete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    findOne: jest.Mock;
    softRemove: jest.Mock;
    find: jest.Mock;
  };
  let usersService: { findOneByEmail: jest.Mock; create: jest.Mock };
  let mailService: { sendInvitationEmail: jest.Mock };
  let grantPolicy: { assertCanGrantRoles: jest.Mock };

  beforeEach(async () => {
    repository = {
      softDelete: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((e) => Promise.resolve({ id: 1, ...e })),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      softRemove: jest.fn(),
      find: jest.fn(),
    };
    usersService = { findOneByEmail: jest.fn(), create: jest.fn() };
    mailService = { sendInvitationEmail: jest.fn() };
    grantPolicy = { assertCanGrantRoles: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: getRepositoryToken(Invitation), useValue: repository },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
        { provide: GrantPolicyService, useValue: grantPolicy },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInvite', () => {
    it('should reject when a user with the email already exists', async () => {
      usersService.findOneByEmail.mockResolvedValue({ id: 1 });

      await expect(
        service.createInvite({ email: 'taken@b.com' }, inviter),
      ).rejects.toThrow(ConflictException);
    });

    it('should drop prior invites, persist a token, mail it and return the url', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);

      const result = await service.createInvite(
        { email: 'new@b.com', roleIds: [2] },
        inviter,
      );

      expect(grantPolicy.assertCanGrantRoles).toHaveBeenCalledWith(
        inviter,
        [2],
      );

      expect(repository.softDelete).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(mailService.sendInvitationEmail).toHaveBeenCalledWith(
        'new@b.com',
        expect.stringContaining('/accept-invite?token='),
      );
      expect(result.inviteUrl).toContain('/accept-invite?token=');
      const created = repository.create.mock.calls[0][0] as Invitation;
      expect(created.email).toBe('new@b.com');
      expect(created.roleIds).toEqual([2]);
      expect(created.invitedBy).toBe(5);
    });

    it('refuses roles the inviter could not grant, before anything is stored', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);
      grantPolicy.assertCanGrantRoles.mockRejectedValue(
        new ForbiddenException(
          'Only a superadmin can grant the superadmin role',
        ),
      );

      await expect(
        service.createInvite({ email: 'new@b.com', roleIds: [1] }, inviter),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.save).not.toHaveBeenCalled();
      expect(mailService.sendInvitationEmail).not.toHaveBeenCalled();
    });
  });

  describe('acceptInvite', () => {
    it('should create a pre-verified user and stamp acceptedAt', async () => {
      const invitation = {
        id: 1,
        email: 'inv@b.com',
        roleIds: [3],
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 10000),
      };
      repository.findOneBy.mockResolvedValue(invitation);

      const result = await service.acceptInvite({
        token: 'tok',
        password: 'password123',
        fullname: 'Inv User',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'inv@b.com', roleIds: [3] }),
        { autoVerify: true, registerMethod: 'INVITATION' },
      );
      expect(invitation.acceptedAt).toBeInstanceOf(Date);
      expect(result.message).toContain('created');
    });

    it('should reject an unknown token', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(
        service.acceptInvite({ token: 'x', password: 'password123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject an already accepted token', async () => {
      repository.findOneBy.mockResolvedValue({
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      });
      await expect(
        service.acceptInvite({ token: 'x', password: 'password123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject an expired token', async () => {
      repository.findOneBy.mockResolvedValue({
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 10000),
      });
      await expect(
        service.acceptInvite({ token: 'x', password: 'password123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getByToken', () => {
    it('should return the invitation email for a valid token', async () => {
      repository.findOneBy.mockResolvedValue({
        email: 'inv@b.com',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 10000),
      });

      await expect(service.getByToken('tok')).resolves.toEqual({
        email: 'inv@b.com',
      });
    });
  });

  describe('resend', () => {
    it('should reject when the invitation is already accepted', async () => {
      repository.findOne.mockResolvedValue({ id: 1, acceptedAt: new Date() });
      await expect(service.resend(1)).rejects.toThrow(BadRequestException);
    });

    it('should bump the expiry and re-send the email', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        email: 'inv@b.com',
        token: 'tok',
        acceptedAt: null,
      });

      await service.resend(1);

      expect(repository.save).toHaveBeenCalled();
      expect(mailService.sendInvitationEmail).toHaveBeenCalledWith(
        'inv@b.com',
        expect.stringContaining('token=tok'),
      );
    });
  });

  describe('revoke', () => {
    it('should soft-delete the invitation', async () => {
      const invitation = { id: 1 };
      repository.findOne.mockResolvedValue(invitation);

      await service.revoke(1);

      expect(repository.softRemove).toHaveBeenCalledWith(invitation);
    });

    it('should soft-delete all found invitations', async () => {
      const invitations = [{ id: 1 }, { id: 2 }];
      repository.find.mockResolvedValue(invitations);

      await expect(service.revokeMany([1, 2])).resolves.toEqual({
        deleted: 2,
      });
      expect(repository.softRemove).toHaveBeenCalledWith(invitations);
    });
  });
});
