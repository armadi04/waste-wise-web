# KuponMalam Portal API

Portal web memakai REST API `/api/portal/*`. Data katalog, voucher, tiket, order, campaign,
following, FAQ, dan notifikasi berasal dari PostgreSQL. Frontend tidak memiliki fixture runtime.

## Public catalog

| Method | Path                                 | Keterangan                                                                                                                   |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/portal/catalog/coupons`            | Katalog kupon; query `q`, `city`, `category`, `sort`, `page`, `limit`, `minPrice`, `maxPrice`, `minDiscount`, `minRating`    |
| GET    | `/portal/catalog/coupons/:slug`      | Detail kupon                                                                                                                 |
| GET    | `/portal/catalog/events`             | Katalog event                                                                                                                |
| GET    | `/portal/catalog/events/:slug`       | Detail event dan ticket options                                                                                              |
| GET    | `/portal/bundles`                    | Bundle aktif                                                                                                                 |
| GET    | `/portal/bundles/:slug`              | Detail bundle                                                                                                                |
| GET    | `/portal/campaigns`                  | Campaign aktif; `page` integer ≥1, `limit` default 24/maksimal 100; terbaru menurut `createdAt`, lalu `id`                   |
| GET    | `/portal/campaigns/:slug`            | Detail campaign                                                                                                              |
| GET    | `/portal/locations`                  | Kota kurasi aktif `[{ name, slug, featured }]` (featured dulu, lalu posisi); turunan katalog bila daftar kurasi kosong |
| GET    | `/portal/catalog/categories`         | Kategori kupon aktif `[{ name, count, slug, label, blurb, icon, position, featured }]` urut posisi lalu nama; query `city` opsional. Filter `category` menerima `name` atau `slug` |
| GET    | `/portal/support/faq`                | FAQ aktif                                                                                                                    |
| GET    | `/portal/content/:key`               | Konten situs terbit (`page.terms`, `page.privacy`, `page.night-work`, `home.claim-guide`, `help.contact`, `status.notice`): `{ key, title, summary, sections[], data, updatedAt }`; 404 bila belum terbit |
| GET    | `/portal/reviews`                    | Review publik; query `targetType`, `targetKey`                                                                               |
| GET    | `/portal/catalog/events/:slug/slots` | Slot reservasi event                                                                                                         |
| GET    | `/portal/gifts/:code`                | Preview gift publik                                                                                                          |

Catalog list memakai envelope `{ "data": [], "meta": { "total": 0, "page": 1, "lastPage": 1 } }`.

## Portal authentication

Portal auth memakai session cookie backend yang sama dengan auth API. Frontend harus mengirim
`credentials: include` dan CSRF header untuk mutation.

| Method | Path                         | Keterangan                                  |
| ------ | ---------------------------- | ------------------------------------------- |
| POST   | `/portal/auth/email/request` | Kirim OTP email; cooldown 60 detik          |
| POST   | `/portal/auth/email/verify`  | Verifikasi OTP dan buat session             |
| POST   | `/portal/auth/google`        | Verifikasi Google ID token dan buat session |
| POST   | `/portal/auth/logout`        | Revoke session                              |
| GET    | `/portal/auth/me`            | Identitas session aktif                     |

Nomor WhatsApp bukan credential login. Simpan nomor melalui `PATCH /portal/me/profile`.

## Authenticated portal resources

Endpoint berikut memerlukan access session valid:

| Method    | Path                                    | Keterangan                                                                                                                                                   |
| --------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET/PATCH | `/portal/me/profile`                    | Baca/update nama, telepon, kota, notifikasi                                                                                                                  |
| POST      | `/portal/coupons/:slug/claim`           | Klaim paket gratis atomik; paket berbayar wajib checkout                                                                                                     |
| GET       | `/portal/me/vouchers`                   | Voucher milik user                                                                                                                                           |
| GET       | `/portal/me/vouchers/:code`             | Detail voucher berdasarkan code                                                                                                                              |
| GET       | `/portal/me/vouchers/:code/qr`          | Token QR berumur pendek `{token, expiresAt, expiresIn}`; 409 jika bukan `Issued`/kedaluwarsa; limit 30/menit per user                                        |
| GET       | `/portal/me/tickets`                    | Tiket milik user                                                                                                                                             |
| GET       | `/portal/me/tickets/:code`              | Detail tiket berdasarkan code                                                                                                                                |
| GET       | `/portal/me/tickets/:code/qr`           | Token QR berumur pendek `{token, expiresAt, expiresIn}`; 409 jika bukan `Issued` atau lewat jendela check-in (mulai event + 24 jam); limit 30/menit per user |
| GET       | `/portal/me/orders`                     | Riwayat order                                                                                                                                                |
| GET       | `/portal/me/orders/:id`                 | Detail order berdasarkan ID atau order number                                                                                                                |
| POST      | `/portal/orders`                        | Buat order; wajib `Idempotency-Key`                                                                                                                          |
| GET/POST  | `/portal/me/following`                  | Baca/tambah following                                                                                                                                        |
| DELETE    | `/portal/me/following/:id`              | Hapus following                                                                                                                                              |
| GET       | `/portal/me/notifications`              | Inbox paginated (page, limit≤50; meta.unread = total belum dibaca)                                                                                           |
| PATCH     | `/portal/me/notifications/:id/read`     | Tandai satu dibaca                                                                                                                                           |
| POST      | `/portal/me/notifications/read-all`     | Tandai semua dibaca                                                                                                                                          |
| GET       | `/portal/me/campaigns`                  | Campaign aktif + progress user (page, limit)                                                                                                                 |
| GET       | `/portal/me/campaigns/:slug/progress`   | Progress campaign user                                                                                                                                       |
| GET       | `/portal/me/reviews`                    | Review user saat ini                                                                                                                                         |
| POST      | `/portal/me/reviews`                    | Submit review setelah redeem/check-in                                                                                                                        |
| GET       | `/portal/me/saved-offers`               | Deal/event tersimpan                                                                                                                                         |
| POST      | `/portal/me/saved-offers`               | Simpan deal/event                                                                                                                                            |
| DELETE    | `/portal/me/saved-offers/:id`           | Hapus deal/event tersimpan                                                                                                                                   |
| GET       | `/portal/me/gifts`                      | Voucher hadiah yang dibuat user                                                                                                                              |
| POST      | `/portal/me/gifts`                      | Buat voucher hadiah dari coupon                                                                                                                              |
| GET       | `/portal/me/rewards`                    | Saldo cashback dan histori reward                                                                                                                            |
| POST      | `/portal/me/orders/:id/pay`             | Buat instruksi VA sandbox (tetap Pending) atau bayar dengan coins                                                                                            |
| POST      | `/portal/me/orders/:id/sandbox-confirm` | Konfirmasi VA simulasi milik akun; hanya sandbox non-production                                                                                              |
| POST      | `/portal/me/orders/:id/cancel`          | Batalkan order Pending dan kembalikan reservasi stok                                                                                                         |
| POST      | `/portal/me/orders/:id/refund-request`  | Ajukan refund untuk order Paid yang belum digunakan                                                                                                          |
| GET       | `/portal/me/bookings`                   | Reservasi event user                                                                                                                                         |
| POST      | `/portal/me/bookings`                   | Reservasi slot event dengan lock kapasitas                                                                                                                   |
| POST      | `/portal/me/bookings/:id/cancel`        | Batalkan reservasi dan kembalikan kapasitas slot                                                                                                             |
| POST      | `/portal/gifts/:code/redeem`            | Klaim gift untuk akun dengan email penerima                                                                                                                  |

Gift berstatus `Ready` sampai integrasi email/payment production diaktifkan. Batasan gift:

- Pengirim tidak bisa mengirim gift ke emailnya sendiri.
- Pengirim maksimal 5 gift per 24 jam (`GIFTS_PER_SENDER_PER_DAY`).
- Throttle per user: 5/menit untuk create dan 10/menit untuk redeem.
- Penerima tidak bisa me-redeem gift yang ia kirim sendiri.
- Penerima tidak bisa me-redeem jika sudah punya voucher untuk paket yang sama. Ini aturan
  satu-voucher-per-paket yang sama dengan klaim. Gift tetap `Ready`, dan admin bisa me-revoke
  gift tersebut untuk mengembalikan stok. Seed demo membuat
`GFT-DEMO-001` dan saldo cashback IDR 35.000 secara idempotent.

Create order example:

```json
{
  "kind": "ticket",
  "slug": "neon-pulse-midnight-techno",
  "ticketType": "Early Bird",
  "attendee": "Nama Peserta",
  "email": "user@example.com",
  "phone": "+62 812 0000 0000"
}
```

Backend menghitung harga dari database. Client tidak boleh mengirim atau mempercayai total
harga dari browser.

Refund request menerima `{ "reason": "..." }` dan menyimpan status `Requested` sampai diproses
oleh approval admin atau konfirmasi refund provider. Request hanya diterima untuk order `Paid`; voucher coupon yang
sudah berstatus `Redeemed` tidak dapat diajukan refund.

### Status voucher dan tiket

Field `status` pada `/api/portal/me/vouchers[/:id]` dan `/api/portal/me/tickets[/:code]` memakai
satu kosakata (`src/portal/pass-status.ts`). Ejaan persis ini adalah kontrak frontend:

| Status      | Sumber      | Arti                                                                                     | QR boleh diterbitkan |
| ----------- | ----------- | ---------------------------------------------------------------------------------------- | -------------------- |
| `Reserved`  | disimpan    | Dibuat saat checkout, order belum dibayar                                                | Tidak                |
| `Issued`    | disimpan    | Aktif, siap dipakai                                                                      | Ya                   |
| `Redeemed`  | disimpan    | Voucher sudah ditukar                                                                    | Tidak                |
| `CheckedIn` | disimpan    | Tiket sudah check-in                                                                     | Tidak                |
| `Cancelled` | disimpan    | Dibatalkan karena refund/pembatalan order                                                | Tidak                |
| `Expired`   | turunan API | `Issued` yang masa berlaku voucher-nya lewat, atau tiket yang lewat start event + 24 jam | Tidak                |

`Expired` tidak pernah ditulis ke database; status tersimpan tetap `Issued`. Review event hanya
diterima untuk tiket `CheckedIn`, review coupon untuk voucher `Redeemed`.

Setiap voucher/tiket juga membawa `orderId: string | null`, yaitu nomor order pemiliknya
(`orderNumber`, mis. `ORD-0070DE7A`) bila pass terhubung ke order milik user yang sama lewat
`orderItemId`, selain itu `null` (klaim gratis, hadiah). Portal memakainya untuk mengarahkan pass
`Reserved` ke `/orders/{orderId}` agar pembayaran bisa diselesaikan. Daftar dimuat dengan satu
query batch (tanpa N+1).

## Seed policy

`PortalSeedService` hanya berjalan saat `NODE_ENV` bukan `production` dan `DB_SEED` bukan `false`.
Seed idempotent berdasarkan slug/code. Untuk membuat akun demo dengan data owned:

```env
NODE_ENV=development
DB_SEED=true
PORTAL_SEED_EMAIL=demo@example.com
PORTAL_SEED_NAME=Demo User
```

Production tidak menjalankan seed. Gunakan migration dan proses import terkontrol untuk data
production.

Development coupon seed includes six additional Jakarta offers with `demo-` slugs and
`[Demo]` titles: Henshin, Paulaner Brauhaus, UNION Plaza Senayan, Cork & Screw Plaza Indonesia,
Loewy and Bistecca SCBD. Merchant identity/location references come from
[The Westin Jakarta](https://www.marriott.com/en-us/hotels/jktwi-the-westin-jakarta/dining/),
[Paulaner](https://www.paulaner-brauhaus-worldwide.com/en/locations/) and
[The Union Group](https://uniongroupjakarta.com/brands). Packages, prices, discounts,
inventory and deadlines are mock data; Unsplash photos are illustrations. Descriptions and
terms identify these as development-only simulations, not merchant promotions. Each gets
one default package through the existing seed flow. Four more `demo-` offers use fictional
`[Demo]` merchants so the Musik and Venue categories have data (two each, Jakarta). Rerunning seed preserves existing rows
and remaining stock; it does not fabricate reviews or ratings.

## Admin portal management

Authenticated admin users manage every `portal_*` table through `/portal/admin/*`. The admin
surface uses the same JWT/cookie authentication and permission guard as the rest of the API.

Resources expose paginated `GET`, detail `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, and
`POST /bulk-delete` endpoints:

- `coupons`, `events`, `event-tickets`, `bundles`, `campaigns`, `faqs`
- `vouchers`, `tickets`, `orders`, `order-items`, `follows`
- `otp-challenges`
- `campaign-progress` is list/detail only: points change through
  `POST campaign-progress/adjustments` (ledger). Migration
  `1791200000000-RetireCampaignProgressWritePermissions` retires its unused
  create/update/delete permissions.
- `reviews` (moderasi `verified` dan balasan merchant), `promo-codes`, `booking-slots`, `bookings`

Customer- and system-owned data is read-only through `PortalAdminRecordsController`:
`customers`, `gifts`, `referrals`, `wallets`, `wallet-transactions`, `saved-offers`,
`campaign-ledger` and `commerce-outbox` expose list and detail `GET` only (generic writes return
409) under `portal.<resource>.read`. Lists accept `userId` (gifts match the sender);
`gifts` also accepts `status`, `commerce-outbox` accepts `delivered=true|false`. `orders`,
`vouchers`, `tickets`, `bookings`, `follows`, `reviews` and `campaign-progress` lists accept the
same `userId` filter. Customers are users holding the `customer` role; `GET customers/:id`
returns order, wallet, pass, booking, gift and referral totals.

Audited actions: `POST gifts/:id/revoke` (`portal.gifts.revoke`, `{reason}`) cancels a Ready gift
and returns its reserved package stock. `POST wallets/adjustments` (`portal.wallets.adjust`,
`{userId, amount, reason, idempotencyKey}`) writes an `adjustment` transaction, refuses a
negative resulting balance and returns `applied: false` when the key is replayed with the same
user/amount (409 for a different one). Migration `1791170000000-AddWalletAdjustmentOperationKey`
adds the unique `operationKey`; `1791171000000-AddPortalRecordPermissions` provisions these
permissions for superadmin.

Curated catalog and content (`PortalAdminCatalogController`):

- `coupon-categories` and `cities` are CRUD resources (`portal.coupon_categories.*`,
  `portal.cities.*`) with case-insensitively unique names. Coupon and event writes must name an
  active category/city (400 otherwise). Every coupon has a required `categoryId`; the `category`
  text in responses is a read-only mirror the database keeps equal to the category name (a
  trigger sets it on each coupon write and a category rename rewrites it), so manual SQL cannot
  make them differ. Catalog filters and category counts use `categoryId` only (the `category`
  query accepts a name or slug). Migration `1791192000000-RequireCouponCategory` linked remaining
  coupons by name and put the rest in "Lainnya". City text on coupons and events is still
  rewritten on rename in the same transaction; deleting a name still in use returns 409.
  Creating a category/city whose name belongs to a soft-deleted entry restores that entry with
  the new details. Featured categories with `label`, `blurb` and `icon` are the portal home lanes.
- `PATCH /portal/me/profile` accepts a new `preferredCity` only when it names an active curated
  city (stored with its canonical name, 400 otherwise); existing values are kept as they are.
- `GET content`, `GET content/:key` and `PUT content/:key` (`portal.content.read|update`) edit the
  registry keys in `portal-content.registry.ts`. Sections are plain text; `data` is validated per
  key (night-work https URL, claim-guide facts, help contact email/WhatsApp/hours, status level).
  Only published entries are public. Each save commits with an outbox `audit.record`
  (`portal.content_update`).
- `GET/POST broadcasts` (`portal.broadcasts.read|create`) sends an in-app notice to every customer
  with notifications enabled, or to listed `userIds`. Each recipient gets an outbox
  `user.notification` keyed `broadcast:{id}:{userId}`; delivery drains in the background and the
  outbox worker finishes anything left. A replayed `idempotencyKey` returns the original broadcast.

Migration `1791180000000-AddCouponCategoriesAndCities` creates both lists from existing coupon
and event text (case/whitespace-insensitive, first spelling wins), carries over the previous
portal lane copy for Kuliner malam/Musik/Venue and links every coupon; the text column stays as
the filter key. `1791181000000-AddPortalContentAndBroadcasts` and
`1791182000000-AddPortalCatalogContentPermissions` add content, broadcasts and their permissions.

Event ticket and order item editors also use nested routes:

- `GET/POST /portal/admin/events/:eventId/tickets`
- `GET/POST /portal/admin/orders/:orderId/items`

`GET /portal/admin/dashboard` returns portal operation counts. Permission keys follow
`portal.<resource>.<create|read|update|delete>`, plus `menu.portal` and
`portal.dashboard.read`. Reviews and bookings have no create route and no `create` permission.
Staff actions use dedicated permissions so a venue role can verify passes without editing
records: `portal.vouchers.redeem` (redeem/scan), `portal.tickets.check_in` (check-in/scan),
`portal.orders.refund` (approve/reject) and `portal.campaign_progress.adjust` (ledger
adjustments). Migration `1791160000000-AddPortalActionPermissions` inserts them, grants each to
every role/user holding the previous `.update` permission and retires the unused review/booking
create permissions.

Payment provider callback:

```http
POST /api/portal/payments/webhook
X-Portal-Webhook-Secret: <PORTAL_PAYMENT_WEBHOOK_SECRET>
Content-Type: application/json
```

Payload status `paid`, `failed`, atau `refunded` memakai `orderNumber`, optional
`paymentReference`, dan optional `paymentMethod: "va"`. Callback ditolak jika secret kosong
atau tidak cocok. Adapter provider nyata cukup meneruskan event terverifikasi ke endpoint ini;
VA/coins bawaan tetap tersedia untuk development.

All deletes are soft deletes. Admin can edit business fields, including ownership, inventory,
status, totals, and codes. The OTP `codeHash` is never returned or accepted by admin endpoints;
admin-created challenges receive a random unusable hash. Admin writes emit system events and
remain visible through the audit trail.

Portal entities returned to a client include immutable `publicId` UUID values. Numeric `id`
remains the internal primary key and admin route identifier; existing slug, code, and order
number paths remain unchanged.

## Media

Portal catalog sementara menyimpan `imageUrl` sebagai URL yang dapat diakses publik. Integrasi
production berikutnya harus mengunggah asset ke Depot melalui `MediaService`, lalu menyimpan
URL view Depot/API pada entity portal. Jangan menaruh binary asset atau secret di frontend.

## Frontend configuration

Portal runs TanStack Start at localhost:3002 and calls same-origin `/api` in production.
Set VITE_API_URL empty; BACKEND_URL is a server runtime origin, not a public Vite variable.
Admin remains a SPA on localhost:3001 with its own `/api` deployment routing to this backend.
Both use backend session cookies; unsafe requests carry CSRF where required.

Portal public catalog SSR uses validated server functions with anonymous backend reads.
Private data stays in browser requests. The portal server proxy excludes `/portal/admin/*`
and provider payment callbacks; those reach this backend through their intended edge routes.
Contract paths and response shapes above remain unchanged by the frontend migration.

[Auth](AUTH.md) defines identity/RBAC; [Operations](OPERATIONS.md) defines deployment and
integration diagnostics; [portal integration](../../../kuponmalam/docs/API_INTEGRATION.md)
defines frontend consumption.

## Customer profile photo

Google portal login enqueues the verified ID token's picture in PostgreSQL when
the customer has no avatar; it waits only for a database write with a one-second statement
timeout, never image download or storage. Existing accounts enqueue on their next Google
login; saved photos are never overwritten. Missing pictures or enqueue failures do not
prevent login. A UTC worker checks every ten seconds, processes up to two jobs sequentially,
and uses a session advisory lock to allow one importer across healthy backend instances.
Jobs have five-minute leases, at most five claimed attempts (including interrupted attempts),
and exponential retry delays starting at thirty seconds. Expired leases survive restarts.
Repeated login does not reset an active job; a later login can requeue a failed job.
Provider URLs are erased after completion or exhausted retries and never logged.

Downloads accept only HTTPS googleusercontent.com hosts, reject redirects, and are limited
to five seconds and 10 MiB including streamed bodies. JPEG, PNG and WebP use the
16-megapixel limit, a three-second Sharp processing timeout, and 512×512 JPEG output.
Linking rechecks the empty avatar under a user row lock with a five-second statement timeout.
Unused staged media enters durable cleanup; linked photos never enter cleanup merely because
cache invalidation fails. Successful linking invalidates users and portal admin caches.
A retry after linking refreshes caches without downloading or storing the photo again.

Apply migration 1791230000000-AddPortalAvatarImports before deploying backend workers;
the existing avatar cleanup migration remains required. Profile responses include
avatarImportPending so the portal can poll while a job is pending, then stop when a
photo is available or retries are exhausted. Older portals may ignore this additive field.

`GET /api/portal/me/profile` and profile writes include `avatarUrl` (nullable).
`POST /api/portal/me/profile/avatar` requires the customer session and accepts one
multipart `avatar`: a JPEG under 1 MiB. After signature validation, Sharp decodes with a 16-megapixel
input limit, rejects malformed images, auto-orients and re-encodes to 512×512 JPEG
without source metadata. The portal
crops locally to 512×512 before uploading. The backend derives the owner from the
session, stores through MediaService/Depot, and updates the existing User.avatar
relation. It returns the updated profile and clears user caches. This endpoint
does not accept a user ID or require administrative media permissions.

Profile PATCH is partial: omitted fields retain their values, phone may be empty,
notifications accept both true and false, and fullname is trimmed and must be nonempty.

Managed portal avatars persist a Media staging row before remote storage. Account
replacement locks the user row and atomically activates the new photo and schedules
the previous managed avatar for cleanup. Generic admin avatar assignment accepts
legacy/admin media only; managed portal photos are attached through the portal service.
The cleanup worker runs every minute, claims up to 20 due rows with SKIP LOCKED and
15-minute leases, and retries remote failures after five minutes. Unattached staging
expires after one hour; expired leases recover after restart. Referenced photos and
unmarked legacy/admin media are preserved. Remote success/404 precedes local soft deletion.
Depot requests and object PUTs have 15-second timeouts. Pending remote reservations
without a saved Depot ID are recovered by their unique filename and session owner.

Migration `1790848800000-AddAvatarCleanupState` must be applied before deploying the
new upload/cleanup code. Inspect due `media.cleanupAt` and stale `cleanupLeaseUntil`
when diagnosing retries; worker warnings include only the media ID. Use the normal
migration deployment process; do not enable synchronize in production.

## Coupon gallery and packages

Catalog coupons include ordered `images: [{url, alt}]` and active `packages` with public UUID, name, benefits, price, oldPrice, stockTotal, stockRemaining and position. The first image supplies the cover. Scalar price/stock values summarize active packages; starting price prefers the cheapest package with stock.

Gift responses and gift emails link to `${PORTAL_APP_URL}/gifts/:code` (`redeemUrl`); the portal redirects older `/hadiah/:code` links.

Claim and gift creation accept optional `packagePublicId`. Omission uses the migrated default package for older clients. Claims are idempotent per user/coupon/package. Coupon then package locks serialize stock changes; gifts reserve one unit at creation, and redemption does not decrement again. Vouchers and gifts expose an immutable `package` snapshot; public gift responses omit recipient email.

Admin coupon create/update accepts ordered `images` (1–10 HTTP(S) URLs, up to 255 characters) and `packages` (1–30). Existing package UUIDs must belong to the coupon. Reordering preserves identity, removed packages become inactive, and total stock cannot be lower than already issued stock. Updates are atomic. Migration `1790900000000-AddCouponPackagesAndGallery` backfills one default package and snapshots for existing records; deploy the backend migration before the new portal/admin.

Saved-offer POST is atomic and idempotent for `(userId, targetType, targetKey)`. Saving again restores the same soft-deleted row and updates its display metadata, while keeping its ID/public UUID. Concurrent saves return one record. DELETE retains soft-delete semantics and checks ownership.

Coupon gallery writes now accept at most 10 ordered photos. Existing longer galleries remain stored; editors must reduce their submitted gallery to the limit. No schema migration is required.

Runtime, technical cron jobs and PostgreSQL sessions use UTC. Absolute inputs require RFC 3339 with Z or an explicit offset and serialize as UTC Z; zone-less absolute input is rejected. Product fallback is Asia/Jakarta. Coupon/event business zones support Asia/Jakarta, Asia/Makassar and Asia/Jayapura, while account display preference is independent and may follow a valid global device zone.

- `GET /api/portal/time/config`: public fallback and supported business zones.
- `GET/PATCH /api/portal/me/preferences`: authenticated account preference shared by portal/admin; `timeZone: null` follows the device. Partial updates to `lastDetectedTimeZone` preserve explicit choice. Responses use `Cache-Control: no-store`.
- `POST /api/portal/time/preview`: authenticated conversion of `{ localDateTime, timeZone }` into `{ instant, localDateTime, timeZone }` using PostgreSQL.

Admin coupon/event writes accept `localTimes` keyed by `expiresAt`/`startsAt` with explicit `timeZone`, as an alternative to the absolute fields. Slot local fields are `startsAt`/`endsAt` and the zone must match the event. Do not send absolute and local representations for the same field. Runtime validation requires one representation even though OpenAPI marks absolute fields optional to permit local input.

Changing a business zone requires `timeZoneChangeMode` (`preserveInstant` or `preserveLocal`) plus `timeZoneChangeReason`; changes are locked and audited. Existing slot instants remain unchanged until edited explicitly. Issued gift/voucher responses include immutable `timeZone` and UTC `expiresAt` snapshots.

Signup charts and user creation filters accept a three-zone `timeZone`, default Jakarta. Calendar ranges end at the exclusive next local midnight. Absolute history uses user display preferences; event and deadline primary labels use business zones. Migration rollout requires proven legacy UTC provenance, backup and the `LEGACY_TIMESTAMP_TIME_ZONE=UTC` guard; see portal `docs/TIMEZONE.md` for the complete contract and deployment steps.

## Coupon catalog filters

Coupon-only query fields: `minPrice`/`maxPrice` are inclusive nonnegative integer IDR
bounds (up to Number.MAX_SAFE_INTEGER); minimum cannot exceed maximum. `minDiscount`
accepts 0–100 and `minRating` accepts 0–5. Invalid numeric values return 400. Omitted or blank
bounds are unrestricted; these fields do not change the event catalog contract.

Price uses the scalar starting price displayed on the coupon card. Discount uses
the same price and oldPrice, rounded to a whole percentage; absent/invalid original
prices yield zero discount. Rating uses non-deleted reviews, rounded to one decimal
as in the card summary. Unrated coupons are excluded whenever minRating is supplied.
All filter groups combine with AND; categories combine with OR. Filtering happens
before count/pagination, with coupon ID breaking sort ties. Page review summaries
are aggregated together independently of package joins. No schema migration is needed.
Deploy this backend contract before releasing the portal filter controls.

### Event availability

Catalog event and ticket-category responses include `availability: { state, remaining }`.
State is `available` for stock >10, `limited` for 1–10, `sold-out` for 0, and
`unavailable` when an event has no ticket categories. Event stock is the sum of
remaining ticket-category stock. Existing `status` text is derived from the same
calculation, rather than stored seed labels. Booking-slot capacity is separate.

Event-ticket admin writes enforce integer stock with `0 <= stockRemaining <= stockTotal`.
Partial updates validate the merged row under the same pessimistic transaction lock used
by checkout, cancellation, and refund stock restoration. Checkout retries acquire a
transaction-scoped advisory lock for the user/idempotency-key before checking existing
orders. Catalog pages batch categories and aggregate reviews rather than querying each event.

## Campaign points and personal rewards

Public campaign list/detail expose structured `rules` and `eligibleProducts`; reward labels
are derived from numeric discount rules. A campaign with null rules earns no new points.
Rules specify activation time, points per source and coupon/event IDs (both empty means all
products). Default configured fixtures award 10/payment, 5/verified usage and 20/referral.
Only positive-total paid orders earn payment/referral points. Usage requires an exact paid
order-item link; historical, claim and gift vouchers never earn usage points. Valid unlinked vouchers may still be redeemed through the verification endpoint without earning points. Sources stack
across every matching active campaign, without historical replay.

Private JWT endpoints:

- `GET /portal/me/notifications?page&limit`: newest first, default 20 and at most 50 per
  page; `meta.unread` counts unread items across all pages and `lastPage` is at least 1.
- `GET /portal/me/referral`: own code and confirmation eligibility.
- `POST /portal/me/referral` with `{code}`: explicitly confirm once before first payment;
  self-referrals, replacements and cycles are rejected. Link prefilling is not confirmation.
- `GET /portal/me/campaigns?page&limit`: every active campaign with the caller's progress
  (same shape as `/progress`) and `participating`; points accrue without enrolment, so
  untouched campaigns report zero points instead of being omitted.
- `GET /portal/me/campaigns/:slug/progress`: points, frozen target, eligibility and own reward.
- `GET /portal/me/campaigns/:slug/history`: paginated own ledger without internal actor IDs.

Admin verification uses `POST /portal/admin/vouchers/:id/redeem` with
`portal.vouchers.redeem`, or `POST /portal/admin/tickets/:id/check-in` with
`portal.tickets.check_in`. Scanners use `POST /portal/admin/vouchers/scan` or
`POST /portal/admin/tickets/scan` with `{token}` under the same permissions; the response
matches redeem/check-in. Scan failures are 400 (malformed, forged, wrong kind or non-HS256
token), 410 (expired token; the customer must refresh the QR) or 404 (pass deleted), never
401, because staff clients treat 401 as an expired session. Pass QR tokens (`KM1.` + HS256
JWT, claims `typ`, `k`, `pid`; algorithm pinned on sign and verify) are issued only for passes
that verification would accept (`Issued`, voucher not expired, ticket within
`isTicketWindowOpen`), expire after `PASS_QR_TTL_SECONDS` (default 60), are signed with
`PASS_QR_SECRET` (never the login secret) and are stateless; replay within the TTL is harmless
because verification is idempotent. Clients count down from receipt using `expiresIn` (not the
device clock against `expiresAt`), refresh before expiry and never present an expired token as
valid. The issue routes are rate-limited per user via `@ThrottlePerUser` + `UserThrottlerGuard`
(customers at a venue share one NAT IP); the global per-IP throttler skips them. Scanner UI is
a separate integration. Audited adjustment uses
`POST /portal/admin/campaign-progress/adjustments` with `portal.campaign_progress.adjust`,
user/campaign IDs, signed points, reason and an idempotency key. Generic progress writes,
resource status changes, order financial edits and order-item creation are rejected.

Awards, resource issuance and refunds share commerce transactions and deterministic locks.
The append-only ledger has unique campaign/user/source keys. Completed refunds append one
reversal per source, including referrer points; refund requests do not reverse anything.
Audited deductions cannot create a negative balance, but later refunds may make the internal
ledger balance negative. Public points floor at zero; later earnings offset that balance.
This prevents an earlier correction from blocking a valid refund or granting extra points.

One personal discount code is issued automatically at target, valid 30 days, with one use.
Only its owner may reserve it at checkout. Cancellation releases reservation; payment consumes
it. Below-target refunds revoke unused codes. Recovery reactivates the same unexpired code
without extending expiry; consumed/expired codes are never replaced. Used codes remain consumed
after refund, without automatic cash debt. Existing progress migrates as a baseline without
minting rewards. Rules freeze after non-baseline activity; targets freeze after any activity.

Authenticated portal and portal-admin writes now enforce `CookieCsrfGuard`: browser cookie
sessions require a matching `csrfToken` cookie and `X-CSRF-Token` header. Bearer clients do not
use ambient cookie authentication and remain supported. JWT, email verification and action
permissions still apply; CSRF never replaces authorization. Public reads and signed provider
webhook calls without session cookies retain their existing contracts.

Commerce/campaign lock waits are capped at five seconds; statements in these transactions
are capped at fifteen seconds. Transient contention, serialization, cancellation and known
connection failures return HTTP 503. Retry the same operation and original checkout/adjustment
idempotency key; do not invent a new key when a response is lost. Successful payment retries
reuse the paid order and never duplicate points. Backend operations documents telemetry and
reconciliation; these features do not change source points or reward policy.

## Checkout packages, VA sandbox and refund approval

`POST /portal/orders` accepts optional UUID `packagePublicId` for `kind: "coupon"`.
The active package must belong to the selected coupon; omitting it selects the default package.
Checkout locks the parent coupon and package, validates expiry/stock, prices from the package,
and stores package identity and benefits/price snapshot on the order item. Coupon vouchers are
issued only on settlement and retain that snapshot. Cancellation, expiry and refund restore
the same package stock. Historical orders without package fields retain legacy recovery.
Direct coupon claim rejects packages with a positive price; gift behavior is unchanged.

New orders reserve stock for up to 24 hours, capped by sales deadlines and event start; fixed voucher expiry also caps coupon checkout. `paymentExpiresAt` is an exclusive
UTC deadline. Orders serialize optional `virtualAccount: {bank, number, sandbox}` and
`canSimulatePayment`. Existing paid orders are unchanged; historical null deadlines remain readable.

Order history now returns `{ data, meta: { total, page, lastPage } }` from
`GET /portal/me/orders?page=1&limit=20&filter=all`. Defaults are page 1 and 20 rows;
the maximum limit is 50 and maximum page is 100000. Filters are `all`, `Pending`, `Paid`,
`Cancelled`, and `Refunded`. Ownership, soft deletion, and effective refund status are applied
before pagination; Paid excludes settled refunds. Ordering is `createdAt DESC, id DESC`.
Update consumers together when deploying this replacement of the previous array response.
The shared refund policy allows new requests only for unused Paid orders with no refund
state or a Rejected request; unknown refund states fail closed. The mutation still locks
and rechecks stored benefits. Item product types are `coupon`, `ticket`, or `bundle`, with
positive integer quantities and nonnegative integer prices (including zero-priced benefits).

Order responses also include `canRequestRefund`, computed from Paid status, refund state,
and the absence of any redeemed voucher or checked-in ticket. List reads batch item and pass
lookups. Mutation responses use their transaction manager, and refund submission still locks
and rechecks usage because eligibility can change after a response is read.
`items` uses the immutable purchase snapshot when available, otherwise stored order items.
Each item includes id, title, productType, quantity, unitPrice, optional nullable unitIndex,
and optional attendee. Legacy missing items return an empty list; current catalog prices are
never substituted. Bundle components keep zero checkout prices and are not added to the
bundle price line again.
`POST /portal/me/orders/:id/pay` with `{paymentMethod: "va"}` creates stable Bank Sandbox
instructions and reference without setting Paid or issuing rewards. Retrying keeps the same
number and deadline. With `coins`, payment debits the existing cashback wallet immediately.
POST `/portal/me/orders/:id/sandbox-confirm` requires an owned order with existing sandbox VA.
Only an explicit confirmation or authenticated provider callback settles VA payment; the same
locked settlement handles issuance, cashback and campaign points exactly once. No real VA bank
integration is supplied. Late coin payments return 409; confirmed late VA payments become
LateSettled with refund Processing and issue no benefits. An every-minute job marks overdue
Pending orders Expired and releases reservations once. Cancellation remains available before cleanup.

`GET /portal/payments/methods` (public) returns `{methods}`: `["va","coins"]` while the VA
sandbox is enabled, otherwise `["coins"]`, so clients never offer a VA that would answer 403.

Gifts (`POST /portal/me/gifts`) accept free coupon packages only (paid packages return 409,
since a gift takes stock without an order) and follow the claim sales window
(`salesEndsAt ?? expiresAt`).

POST `/portal/admin/orders/:id/refund-approve` requires `portal.orders.refund` and a Paid order
with `refundStatus: "Requested"` or a failed refund eligible for retry. LateSettled payments
can also be refunded; external VA approvals remain Processing until provider confirmation. Approval and provider refund callbacks share one transaction,
recheck pass usage, cancel unused passes, restore stock only while still sellable, reverse campaign points and
cashback, and mark Refunded. Coin refunds return principal to the wallet; VA sandbox refunds are
simulated. External/historical VA refunds require provider confirmation rather than admin
pretending to transfer money. Repeated completed refunds return the existing result.
Completed refunds enqueue an audit and customer notification in the same transaction;
delivery runs after commit and retries through the durable outbox.
Wallet cashback reversal removes the full cashback originally awarded, even when previously
spent cashback makes the wallet balance negative. Coin payment principal is returned in full.
Wallet creation uses insert-or-ignore followed by a row lock inside the transaction.

Verification emits `portal.voucher_redeem` or `portal.ticket_check_in` audits with actor,
resource ID, timestamp and outcome (`verified`, `repeated`, `rejected`); QR tokens are omitted.
Staff are authorized through the dedicated redeem/check-in permissions, without merchant account isolation.
Commerce mutations and expiry clear cached admin portal lists so requests/status updates appear.
Generic admin order creation, financial edits and order-item creation/deletion are blocked;
pending item titles remain editable.

## Quantity checkout and immutable commerce snapshots

`GET /portal/me/purchase-limit?kind=coupon|ticket|bundle&slug=...` returns remaining per-user
quantity (`null` means unlimited). Ticket limits span event ticket types; bundle uses the lowest
remaining cap across bundle, coupon, and event. Both endpoint and order creation share SQL counts
for paid/live orders, including legacy items. Checkout refreshes this response before submission;
order creation remains authoritative under the per-user lock.

`POST /portal/me/orders` accepts optional integer `quantity` (1–10, default 1) and
`attendees` for tickets/bundles. New clients send attendees for quantity 1 too; legacy
attendee becomes one participant when attendees is absent. Single-ticket conflicting
names or an incorrect count return 400; repeated names are valid. Email/phone remain
one buyer contact. Coupon quantity shares one holder.

Per-order and cumulative per-user limits are nullable admin settings on coupons, events,
and bundles. Default is 10 per order and unlimited per user. Active Pending reservations
and Paid purchases count, including used benefits; expired/cancelled/fully refunded
orders do not. Bundle checks all three limits and component stocks. Limit decisions are
serialized by existing user commerce locks; stock rows are always locked coupon-before-ticket.

Order request fingerprint covers normalized fields. Same user/key with a different
payload returns 409. Legacy orders without a fingerprint remain readable/payable/refundable;
reusing their create key returns 409 with their existing order number. New orders store
price/promo/participant/component snapshots. Percentage discounts apply to quantity subtotal;
fixed discounts apply once, with existing maximum/minimum rules. Promo redemption increments
once at settlement; pending reservations prevent exceeding a usage limit.

Bundle admin selects packageId and ticketTypeId belonging to its coupon/event. Migration
1791104000000-ConfigureLegacyBundles links existing bundles to each coupon’s default package
and the event’s Early Bird ticket (or its sole active ticket). Migration
`1791105000000-CommerceLimitConsistency` fills only clear defaults/unique components and gives
legacy pending orders a 24-hour deadline from creation. `1791106000000-ReviewLegacyBundleComponents`
marks older heuristic component choices for admin review; flagged bundles stay unavailable until
an administrator confirms both components. The migrations index per-user live-order counts. The
price line carries bundle quantity and price;
per-unit coupon/ticket component lines carry zero checkout price and internal allocation.
Allocation is proportional to catalog component prices (50:50 if both zero), rounding down
coupon allocation and giving the remainder to the ticket. Each component stores unitIndex;
its unique orderItemId connects the independently issued voucher/ticket. Configuration changes
never rewrite existing order snapshots. Event cancellation after voucher usage requires
manual reconciliation; automatic refunds remain whole-order only.

Coupon salesEndsAt is distinct from fixed expiresAt. Optional positive validityDays starts
at voucher issuance; it requires salesEndsAt and ignores fixed expiry for checkout. Fixed
coupons cap payment by both sale end and expiry; tickets cap by salesEndsAt and event start.
Missing legacy sales ends fall back to fixed coupon expiry/event start. Payment deadline is
exclusive and capped by 24 hours and all relevant component sales/event boundaries.

Successful VA confirmations at/after deadline (also after cancellation) produce LateSettled
and Processing refund, without reserving again, issuing benefits, or awarding cashback/points.
The order remains Expired/Cancelled. Sandbox admin approval confirms the simulated refund;
external VA requires provider confirmation, and no real bank request is implemented.
Callback status refund_failed moves Processing to Failed. Duplicate settlement/refund is a
no-op; conflicting settled payment methods/references return 409.

Refund Requested/Processing/Failed freezes passes as RefundPending under order/pass locks;
QR issuance and scanning refuse them. Requested may be rejected by
`POST /portal/admin/orders/:id/refund-reject` with a nonblank reason and portal.orders.refund.
Rejection restores Issued status; normal expiry/check-in rules still apply. Approving external
VA records Processing without claiming funds were returned. Refund confirmation releases
reserved inventory once, only when stock is still sellable; retired/expired units are not
restocked. Financial/pass writes and per-unit issuance are one transaction; failure rolls back
all effects. Unique orderItemId pass indexes prevent duplicate issuance. Existing duplicate
historical links must be reconciled before applying the migration; it does not delete them.

Commerce audit/notifications use a durable outbox. A minute worker retries after delivery
failure; unique event receipts on audit/notifications prevent duplicate persistence after a
worker crash. Delivery failure does not repeat wallet, reward, issuance or inventory effects.


## Admin stock, booking and uniqueness rules

Ticket edits ignore submitted `stockRemaining`; changing `stockTotal` shifts remaining stock
by the same difference. A total below already sold or reserved units returns 409. On creation,
remaining stock defaults to total. Slot edits similarly ignore submitted `remaining` and
preserve booked seats when capacity changes; capacity below booked seats returns 409.
`Full`/`Available` follow remaining seats automatically; `Closed` is a manual override.
Admin booking status changes and soft-deletes adjust slot seats transactionally. Reserved,
Confirmed and Completed hold a seat; reinstating a cancelled booking requires a free seat.
Admin stock remaining fields are read-only.

Migration `1791220000000-PartialUniqueIndexesForSoftDelete` makes email (case-insensitive),
role name, user/slot booking, user/target review and event/start slot unique among live rows.
Soft-deleted rows no longer block reuse. Duplicate reviews and slots return 409.
The migration aborts if live account emails differ only by case; resolve those accounts before
applying it. Reverting can fail if reuse has created duplicates against the old global keys.

Migration `1791221000000-AddCommerceOutboxDeadLetter` adds `attempts`, `lastError` and
`failedAt`. Delivery handles each event independently in oldest-first batches of up to 100.
Listener failures are logged and recorded without blocking later events. After five failures,
`failedAt` marks the event as dead-lettered and excludes it from automatic retry.
Successful delivery clears `lastError`; consumers still deduplicate by `eventId`.
Customer portal mutations invalidate backend `*/portal/admin*` cached lists.

Portal notification read-all returns `{ message: string }` after the update succeeds. Linked voucher/ticket edits accept unchanged business fields but reject actual changes. Campaign rule equality ignores object key order, product-ID set order and equivalent timestamp offsets.

Following target types are `coupon`, `event`, and `merchant` for both customer and admin writes. Pass admin updates lock the current row within a transaction, remove unchanged protected fields, and update only supplied writable columns. Usage status cannot be reset by a concurrent metadata edit.

## Email OTP security

`POST /api/portal/auth/email/request` accepts `{ email, turnstileToken? }`.
When enabled, Turnstile verification precedes creation of an OTP challenge/email.
Real tokens must have action `portal-email-otp` and match `TURNSTILE_ALLOWED_HOSTNAMES`.
Invalid/expired/replayed challenges answer 400; provider/configuration failures answer 503.
The endpoint also has a per-IP 10/minute limit before Siteverify, alongside existing OTP
per-email budgets. The portal uses its matching public `VITE_TURNSTILE_SITE_KEY` at build time;
each retry needs a fresh token. Google login and OTP code verification do not require CAPTCHA.
Activation/defaults and production configuration are in [Auth](AUTH.md).
