# Integration Audit

## Flows traced (static, code-level)

**Auth:** Mobile `GoogleSignin` (ID token, `webClientId`) → `POST /auth/mobile/google` → `verifyIdToken` (audience = `GOOGLE_CLIENT_ID`) → `findOrCreateGoogleUser` (match by email, else create with `user` role) → 2FA challenge if enabled → access+refresh tokens → SecureStore. Refresh de-duplicated client-side; 401 triggers one retry. Issues: SEC-001, SEC-002. Production note: seeding is disabled when `NODE_ENV=production`, and `findOrCreateGoogleUser` returns 503 if the `user` role is missing, so first deploy needs a controlled seed (documented in OPERATIONS.md).

**Report submission:** pick/capture → size/type check → re-encode JPEG ≤1600 px (strips EXIF) → `POST /media/upload` (magic-byte check, S3) → GPS (high accuracy, 15 s timeout) → `POST /reports` → backend fetches signed URL, posts to ML `/api/v1/predict` → maps class, checks confidence and ML_MIN_CONFIDENCE → saves report. Backend alone writes category, confidence, model version, so clients cannot forge predictions.

**Report management:** list/detail scoped by `reports.read.all` vs own; status endpoint needs `reports.status.update`; transitions PENDING→IN_PROGRESS/REJECTED, IN_PROGRESS→COMPLETED/REJECTED; event emitted to notify reporter. Users edit/delete only own PENDING reports.

## Findings

### [INT-001] Medium: timeout mismatch and no idempotency
Classification runs inline in `POST /reports`: image fetch (up to 15 s) then predict (up to 15 s) = up to 30 s worst case. Mobile axios timeout is 30 s (`src/api/client.ts`). The client can time out while the server still saves the report; the retry creates a duplicate. CORS allows an `Idempotency-Key` header but nothing implements it.
Fix: implement idempotency key on create (or dedupe by mediaId + reporter), and/or lower ML timeouts to total under 20 s, and raise mobile create timeout. Effort S–M.

### [INT-002] Low: failed classification is permanent
`ML_UNAVAILABLE`/`MEDIA_UNAVAILABLE` leave `predictedCategory=null` forever. No retry job or admin re-classify action. Admin UI filter `UNCLASSIFIED` exists, but no remedy. Fix: re-classify endpoint or scheduled retry.

### [INT-003] Low: coordinate inconsistency
Mobile requires latitude and longitude (`CreateReportInput`); backend treats both as optional and accepts one without the other (the CHECK constraint passes on NULL). Fix: DTO rule "both or neither", and decide whether location is required.

### [INT-004] Low: no status history
Status changes exist only as audit-log events and notifications. The user cannot see who changed what and when. Acceptable if documented; otherwise add a `report_status_history` table.

### [INT-005] Low (potential): status race
`updateStatusForActor` reads status, validates, then updates unconditionally. Two concurrent admin requests could both pass validation. Fix: `UPDATE ... WHERE id=? AND status=?` and check affected rows.

## Contract consistency

- `swagger.json` paths match both `api.generated.ts` copies (same 3956 lines in web and mobile); reports and mobile auth paths present. Not regenerated (would modify files).
- Validation aligned: description 3–2000, lat/lng ranges, 5 MB image limit on both sides. Backend upload limit is 20 MB, report limit 5 MB.
- ML class names (`organic/plastic/paper`) mapped in `classification.service.ts`; unknown or malformed → `ML_INVALID_RESPONSE`.
- ML error mapping: 400/413/415 → `ML_REJECTED_IMAGE`; everything else, including a 500 from a decompression bomb, → `ML_UNAVAILABLE` (misleading, see SEC-005).
- Image storage: report references media by FK with RESTRICT; media URL is public (SEC-003).

## Not verified
Live end-to-end run (needs DB, S3, ML, Google). Android GPS accuracy and permission-denied flows were only covered by mocked jest tests.
