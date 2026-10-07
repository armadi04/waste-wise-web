import { describe, expect, it, jest } from 'bun:test';
import { ForbiddenException } from '@nestjs/common';
import { OAuthClientService } from '@/oauth/oauth-client.service';
import type { OAuthClient } from '@/oauth/entities/oauth-client.entity';

function serviceWith(client: Partial<OAuthClient>) {
  const service = Object.create(
    OAuthClientService.prototype,
  ) as OAuthClientService;
  const update = jest.fn((_id: number, dto: unknown) => Promise.resolve(dto));
  Object.assign(service, {
    findOne: jest.fn(() => Promise.resolve(client)),
    update,
  });
  return { service, update };
}

describe('OAuthClientService.updateClient', () => {
  it('refuses widening a client past the editor’s own permissions', async () => {
    const { service, update } = serviceWith({ scopes: ['media.read'] });
    await expect(
      service.updateClient(1, { scopes: ['media.read', 'users.delete'] }, [
        'oauth.clients.update',
        'media.read',
      ]),
    ).rejects.toThrow(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('lets an editor keep or drop scopes a superadmin granted earlier', async () => {
    const { service, update } = serviceWith({
      scopes: ['users.read', 'media.read'],
    });
    await service.updateClient(1, { name: 'Renamed', scopes: ['users.read'] }, [
      'oauth.clients.update',
    ]);
    expect(update).toHaveBeenCalledWith(1, {
      name: 'Renamed',
      scopes: ['users.read'],
    });
  });

  it('rejects comma scopes on update as on create', async () => {
    const { service } = serviceWith({ scopes: [] });
    await expect(
      service.updateClient(1, { scopes: ['a,b'] }, ['*']),
    ).rejects.toThrow('Scopes must not contain commas');
  });

  it('skips the scope check when scopes are not being changed', async () => {
    const { service, update } = serviceWith({ scopes: ['users.read'] });
    await service.updateClient(1, { isActive: false }, []);
    expect(update).toHaveBeenCalledWith(1, { isActive: false });
  });
});
