import { afterEach, describe, expect, it } from 'bun:test';
import { PortalGiftsService } from '@/portal/gifts/portal-gifts.service';
import { portalGiftUrl } from '@/portal/gifts/portal-links';
import type { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';

const originalPortalUrl = process.env.PORTAL_APP_URL;

afterEach(() => {
  if (originalPortalUrl === undefined) delete process.env.PORTAL_APP_URL;
  else process.env.PORTAL_APP_URL = originalPortalUrl;
});

describe('portal gift links', () => {
  it('points gift links at the portal gift route', () => {
    expect(portalGiftUrl('GFT-ABC', 'https://kuponmalam.com')).toBe(
      'https://kuponmalam.com/gifts/GFT-ABC',
    );
    expect(portalGiftUrl('GFT-ABC', 'https://kuponmalam.com/')).toBe(
      'https://kuponmalam.com/gifts/GFT-ABC',
    );
    expect(portalGiftUrl('GFT A/B', 'https://kuponmalam.com')).toBe(
      'https://kuponmalam.com/gifts/GFT%20A%2FB',
    );
  });

  it('falls back to the local portal when PORTAL_APP_URL is unset', () => {
    delete process.env.PORTAL_APP_URL;
    expect(portalGiftUrl('GFT-ABC')).toBe(
      'http://localhost:3002/gifts/GFT-ABC',
    );
  });

  it('serializes gift redeem URLs without the legacy hadiah segment', () => {
    process.env.PORTAL_APP_URL = 'https://kuponmalam.com';
    const service = Object.create(PortalGiftsService.prototype) as {
      serializeGift(gift: PortalGift): { redeemUrl: string };
    };
    const gift = { code: 'GFT-ABC' } as PortalGift;
    const { redeemUrl } = service.serializeGift(gift);
    expect(redeemUrl).toBe('https://kuponmalam.com/gifts/GFT-ABC');
    expect(redeemUrl).not.toContain('/hadiah/');
  });
});
