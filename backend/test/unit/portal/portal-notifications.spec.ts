import { describe, expect, it, mock } from 'bun:test';
import { PortalCustomerService } from '@/portal/customer/portal-customer.service';
import type { AuthenticatedUser } from '@/auth/interfaces/auth-request.interface';

const user = { userId: 7, roles: ['user'] } as AuthenticatedUser;

function serviceWith(total: number, unread: number) {
  const findAllForUser = mock(
    (_userId: number, _roles: string[], page: number, limit: number) =>
      Promise.resolve({
        data: [{ id: 1, isRead: false }],
        meta: { total, page, lastPage: Math.ceil(total / limit) },
      }),
  );
  const getUnreadCount = mock(() => Promise.resolve(unread));
  const service = Object.assign(
    Object.create(PortalCustomerService.prototype),
    {
      notificationsService: { findAllForUser, getUnreadCount },
    },
  ) as PortalCustomerService;
  return { service, findAllForUser, getUnreadCount };
}

describe('PortalCustomerService.listNotifications', () => {
  it('forwards paging and reports the unread total across every page', async () => {
    const { service, findAllForUser } = serviceWith(45, 31);
    const result = await service.listNotifications(user, 2, 20);

    expect(findAllForUser).toHaveBeenCalledWith(7, ['user'], 2, 20);
    expect(result.meta).toEqual({
      total: 45,
      page: 2,
      lastPage: 3,
      unread: 31,
    });
  });

  it('keeps lastPage at one for an empty inbox', async () => {
    const { service } = serviceWith(0, 0);
    const result = await service.listNotifications(user);
    expect(result.meta).toEqual({ total: 0, page: 1, lastPage: 1, unread: 0 });
  });
});

describe('PortalCustomerService.markAllNotificationsRead', () => {
  it('returns a message after the scoped update succeeds', async () => {
    const markAllAsRead = mock(async () => ({
      affected: 2,
      raw: [],
      generatedMaps: [],
    }));
    const service = Object.assign(
      Object.create(PortalCustomerService.prototype),
      {
        notificationsService: { markAllAsRead },
      },
    ) as PortalCustomerService;
    expect(await service.markAllNotificationsRead(user)).toEqual({
      message: 'All notifications marked as read',
    });
    expect(markAllAsRead).toHaveBeenCalledWith(user.userId, user.roles);
  });
  it('propagates update failures', async () => {
    const service = Object.assign(
      Object.create(PortalCustomerService.prototype),
      {
        notificationsService: {
          markAllAsRead: async () => {
            throw new Error('database unavailable');
          },
        },
      },
    ) as PortalCustomerService;
    await expect(service.markAllNotificationsRead(user)).rejects.toThrow(
      'database unavailable',
    );
  });
});
