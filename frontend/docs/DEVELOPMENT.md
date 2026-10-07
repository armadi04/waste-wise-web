# Admin development

## Setup

Use Bun (CI uses 1.3.14). Start backend at localhost:3000, then from frontend/:

```bash
bun install --frozen-lockfile
bun run dev
```

Vite runs at `http://localhost:3001` and proxies `/api` to backend localhost:3000.
Keep `VITE_API_URL` empty for relative same-origin requests. If creating a local `.env`, copy
only an existing project template when available; never overwrite existing credentials.
Socket origin also derives from public API configuration; see SocketBridge for deployment.

## Public build configuration

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Optional absolute API/socket origin; empty uses same-origin |
| `VITE_GOOGLE_CLIENT_ID` | Public Google client ID; optional Google sign-in |
| `VITE_TURNSTILE_SITE_KEY` | Public CAPTCHA site key; optional login CAPTCHA |
| `VITE_SSO_SILENT` | Set true to opt in to one-attempt silent SSO |

These are build-time browser values. Backend holds JWT, SMTP, Depot, DB and OIDC secrets.
Changing Vite values requires restart/rebuild. Cross-origin browser access needs credentials
and exact backend ALLOWED_ORIGINS, including localhost:3001 locally; wildcard disables
credentialed CORS. Prefer same-origin deployment.

## Commands and tests

```bash
bun run lint
bun run test
bun run build
```

E2E is optional and runs only when explicitly requested by the user:

```bash
bun run test:e2e
```

PR/push Frontend CI runs the default checks without E2E. To request E2E in GitHub Actions,
manually dispatch the Frontend CI workflow and enable `run_e2e` (default: false). Unrequested
E2E is not a required check or a reason to mark verification incomplete.

`build` runs Vite then TypeScript; `lint` runs ESLint. `check` runs Prettier --write and
ESLint --fix; use it intentionally because it rewrites files. `preview` previews static output.

Vitest discovers `test/**/*.test.{ts,tsx}` with the `@` alias and excludes `test/e2e/`.
Playwright runs a separate Vite server on port32012 with mocked browser API responses and
empty API base URL. It checks authenticated deep links/filter reuse, loader/hook deduplication
and signed-out redirects without runtime errors. It does not require the production database.

Local browser defaults to `/usr/bin/google-chrome`; override
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` when needed. CI uses bundled Chromium installed via
`bunx playwright install --with-deps chromium`. Provider OTP/OIDC/Google must be accepted
separately with real staging services. Portal browser tests run from the portal repo.

## Generated contracts

Backend `bun run spec:generate` produces swagger.json. Generate OpenAPI types with
`bunx openapi-typescript ../backend/swagger.json -o src/types/api.generated.ts` when contracts change.
The generated file is excluded from ESLint; update consumers to match the backend contract
instead of manually editing generated types. Pagination metadata uses `lastPage`.
Never invent response types to hide a contract mismatch or edit the route tree manually.

## Coupon editor

The coupon modal owns gallery and package drafts through React Hook Form. The first photo is the cover; arrows reorder photos/packages. Media selection requires `media.read`; URL entry remains available with coupon update permission. Package stock totals preserve issued vouchers; failed saves retain the draft. Generated API types come from backend Swagger. The browser coupon editor test covers ordering, stock preview, permission-gated media and retry preservation.

Coupon Create/Edit places identifying fields before gallery/packages. Its read-only summary derives cover, starting price/discount and stock from the draft; final stock remains backend authority. Gallery accepts up to 10 photos through URL, public media selection (`media.read`) or sequential upload (`media.create`). Upload fills empty slots, rejects excessive batches before sending requests and retains successful photos after partial failures. Saving/closing is blocked while uploading. The browser test covers these behaviors and failed save preservation.

Photos uploaded during coupon editing remain in the media library if the coupon draft is later canceled or its save fails; closing/submission is disabled during an active upload.

Portal resource form/detail modals and nested relation modals share `modal-styles.ts`: an opaque bordered panel, dimmed backdrop, separated fixed header/footer, and an internally scrolling body. Keep these boundaries consistent across `/portal/*` resources.

Runtime and PostgreSQL sessions use UTC. Absolute API timestamps require RFC 3339 with an explicit offset and serialize as UTC `Z`. Product fallback is `Asia/Jakarta`; display preference is account/device-specific and shared between admin and portal. Coupon/event business zones support Jakarta, Makassar and Jayapura; local schedule inputs are converted by the backend with explicit zones and UTC previews. Date-only values remain calendar dates. Report filters specify their zone and use exclusive following midnight. See the portal `docs/TIMEZONE.md` for the full contract and guarded migration rollout.


## Portal resource capabilities and staff actions

Each `portalResourceConfigs` entry may declare `capabilities` (`create`, `update`, `delete`,
`bulkDelete`); omitted keys default to allowed. Table toolbar and row actions combine them with
the user's `portal.<resource>.*` permissions, so declare a capability as false whenever the
backend rejects that write (checkout-owned orders/items, ledger-owned campaign progress,
customer-created reviews/bookings). Fields the backend changes only through dedicated actions,
such as voucher/ticket status, stay `readOnly`. Field type `select` renders `options`.

Staff actions use dedicated permissions: Redeem (`portal.vouchers.redeem`) and Check in
(`portal.tickets.check_in`) appear on Issued passes; Adjust points
(`portal.campaign_progress.adjust`) opens a modal that sends a per-open idempotency key to the
ledger endpoint. `/portal/scan` verifies customer QR codes from a USB scanner/paste field or the
camera (decoded with `jsqr`); the token's kind claim only selects the voucher/ticket endpoint,
and the backend still verifies the signature. Campaign forms edit points `rules` through
`campaign-form-extension.tsx`; disabling rules sends `null` (display-only campaign).

Customer- and system-owned resources (customers, gifts, referrals, wallets, wallet
transactions, saved offers, campaign ledger, commerce outbox) are read-only configs. Their row
actions are Revoke gift (Ready only, reason required), Adjust balance (per-open idempotency key)
and Open customer. `/portal/customers/$customerId` shows the customer summary and a `tab`/`page`
URL-validated list of that customer's records, loaded through the admin list `userId` filter
and gated per tab by the resource read permission.

Coupon and event forms choose `category`/`city` with `lookup` fields: a select over the active
names of the `coupon-categories`/`cities` resources (`portalLookupQueryOptions`), so values
always match the curated lists the backend validates. `/portal/content` edits the portal content
registry keys (title, summary, plain-text sections, key-specific settings, published toggle)
with the selected key in the `key` URL param. Broadcasts are send-only: the form adds a per-open
idempotency key and converts comma-separated IDs for the `userIds` audience.

## Portal order refund actions

Orders with Paid/Requested state expose Approve refund to `portal.orders.refund` holders.
The action confirms the order/amount and calls the dedicated refund-approve endpoint, then
invalidates portal/notification queries. The backend rechecks usage and handles settlement.
VA sandbox refunds are simulations; external VA refunds require provider confirmation.
Order financial fields and refund metadata are read-only. Order-item relations permit reading
and pending title edits; creation/deletion remain checkout-owned. Event-ticket relations retain
their permission-gated inline CRUD forms.


### Quantity checkout administration

Coupons/events/bundles allow optional per-order and cumulative user limits; blank means no
product-specific limit (checkout retains a system maximum of 10 per order). Coupon validity
can use fixed expiry or days since issuance; duration requires a separate sales end. Bundle
component selectors show only the related coupon's active packages and event's ticket types,
with read-permission-gated queries. Incomplete bundles cannot be purchased.

Order detail exposes immutable purchase snapshots and bundle component allocation for
reconciliation. Refund approval/required-reason rejection use dedicated guarded operations;
Requested/Processing/Failed benefits remain blocked until rejected or refunded. External VA
approval records Processing and requires provider confirmation; sandbox refunds are simulated.

## Turnstile deployment

`VITE_TURNSTILE_SITE_KEY` is public build configuration; production builds reject official
dummy site keys. Put official test site keys in `.env.development.local`, not the shared
`.env`, so `bun run build` does not inherit development keys. Leave
`VITE_TURNSTILE_SITE_KEY` unset in `.env` when using this override: Bun forwards even an
empty value to Vite with higher priority than mode-specific files. Vite reads
`.env.development.local` only in development mode.

With no production site key configured, a local `bun run build` omits CAPTCHA. Configure
a real site key for deployments and configure the corresponding backend policy separately.
The one-off local override `VITE_TURNSTILE_SITE_KEY= bun run build` remains available. Real keys, shared-widget hostnames and expected action must match
[backend Auth](../../backend/docs/AUTH.md). Widget tests mock the provider; they do not prove
Cloudflare behavior or staging reverse-proxy configuration.
