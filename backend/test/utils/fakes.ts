import { jest } from 'bun:test';

/**
 * In-memory stand-ins for the external services the app talks to, so E2E tests
 * are deterministic and need no real credentials or network access.
 */

export interface FakeMailService {
  sendVerificationEmail: jest.Mock;
  sendInvitationEmail: jest.Mock;
  sendPasswordReset: jest.Mock;
  sendPortalGift: jest.Mock;
}

export function makeFakeMail(): FakeMailService {
  return {
    sendVerificationEmail: jest.fn(async () => undefined),
    sendInvitationEmail: jest.fn(async () => undefined),
    sendPasswordReset: jest.fn(async () => undefined),
    sendPortalGift: jest.fn(async () => undefined),
  };
}

export const fakeTurnstile = {
  verify: async (): Promise<void> => undefined,
};

export const passThroughGuard = {
  canActivate: (): boolean => true,
};

/**
 * Fake Depot `DepotClient`. `upload` returns a fake `MediaFile`, `getUrl` a
 * fake signed URL, and `delete` is a no-op — so upload / view / stream / delete
 * endpoints behave end-to-end without touching Depot or S3.
 */
export function makeFakeDepot() {
  let nextId = 1;
  const files = new Map<
    number,
    {
      id: number;
      name: string;
      ownerUserId: number | null;
      s3Key: string;
      mime: string;
      size: number;
      status: string;
    }
  >();
  const reserve = (input: {
    name: string;
    mime: string;
    size?: number;
    ownerUserId?: number;
  }) => {
    const id = nextId++;
    const file = {
      id,
      name: input.name,
      ownerUserId: input.ownerUserId ?? null,
      s3Key: `uploads/${id}-${input.name}`,
      mime: input.mime,
      size: input.size ?? 0,
      status: 'pending',
    };
    files.set(id, file);
    return file;
  };
  return {
    upload: async (input: {
      name: string;
      mime: string;
      size?: number;
      ownerUserId?: number;
    }) => ({ ...reserve(input), status: 'ready' }),
    createUpload: async (input: {
      name: string;
      mime: string;
      size?: number;
      ownerUserId?: number;
    }) => {
      const file = reserve(input);
      return {
        fileId: file.id,
        uploadUrl: `https://depot.test/upload/${file.id}`,
        s3Key: file.s3Key,
        expiresIn: 900,
      };
    },
    completeUpload: async (id: number) => {
      const file = files.get(id)!;
      file.status = 'ready';
      return file;
    },
    list: async (query: { search?: string; page?: number; limit?: number }) => {
      const data = [...files.values()].filter(
        (file) => !query.search || file.name.includes(query.search),
      );
      const page = query.page ?? 1;
      const limit = query.limit ?? 100;
      return {
        data: data.slice((page - 1) * limit, page * limit),
        meta: {
          page,
          limit,
          total: data.length,
          totalPages: Math.ceil(data.length / limit),
        },
      };
    },
    getUrl: async (fileId: number) => ({
      url: `https://depot.test/signed/${fileId}`,
      expiresIn: 900,
    }),
    delete: async (id: number) => {
      files.delete(id);
      return {};
    },
  };
}
