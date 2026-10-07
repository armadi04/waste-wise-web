import { describe, it, expect, jest } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SsoService } from '@/sso/sso.service';
import { UsersService } from '@/users/users.service';
import { Role } from '@/roles/entities/role.entity';
import { RegisterMethodEnum } from '@/users/register-method.enum';

describe('SSO registration provenance', () => {
  it('marks a newly provisioned identity as SSO', async () => {
    const users = {
      findOneByEmail: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 42,
          email: 'sso@example.test',
          password: 'hidden',
          registerMethod: RegisterMethodEnum.SSO,
        }),
      create: jest.fn(),
    };
    const roles = { findOneBy: jest.fn().mockResolvedValue({ id: 3 }) };
    const service = new SsoService(
      new ConfigService({}),
      users as unknown as UsersService,
      roles as unknown as Repository<Role>,
    );
    const user = await service.provisionUser({
      sub: 'identity',
      email: 'sso@example.test',
    });
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'sso@example.test' }),
      { autoVerify: true, registerMethod: RegisterMethodEnum.SSO },
    );
    expect(user.registerMethod).toBe(RegisterMethodEnum.SSO);
    expect(user).not.toHaveProperty('password');
  });

  it('does not rewrite provenance when an existing identity uses SSO', async () => {
    const original = {
      id: 42,
      email: 'existing@example.test',
      fullname: 'Original',
      password: 'hidden',
      registerMethod: RegisterMethodEnum.EMAIL_OTP,
    };
    const users = {
      findOneByEmail: jest.fn().mockResolvedValue(original),
      create: jest.fn(),
      update: jest.fn(),
    };
    const service = new SsoService(
      new ConfigService({}),
      users as unknown as UsersService,
      {} as Repository<Role>,
    );
    const user = await service.provisionUser({
      sub: 'identity',
      email: original.email,
      name: 'Updated',
    });
    expect(users.create).not.toHaveBeenCalled();
    expect(users.update).toHaveBeenCalledWith(42, {
      fullname: 'Updated',
      phone: undefined,
    });
    expect(user.registerMethod).toBe(RegisterMethodEnum.EMAIL_OTP);
  });
});
