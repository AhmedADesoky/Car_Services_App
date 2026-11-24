<div class="cover" markdown="1">
# Ahmed Abdelsamad — Backend Core Lead
<div class="meta">Android team · Owner of the backend core (tenancy, identity, permissions, audit, idempotency, outbox, orders, attendance) <b>and of the company side: Admin API, Admin Console website and Public Website</b>.<br>Reviewer for: Mostafa (backend platform), Fares (money backend). Your reviewer: Mostafa / Fares.</div>
<span class="badge">CORE · MOST CRITICAL PATH</span>
</div>

## 0. Why you are on the critical path
Every other module calls code you own: `Db_Client`, the tenant guard, `@Requires(...)` permissions, `Audit_Service`, `Idempotency`, `Crypto_Service`, `Outbox`. Ship those **first (weeks 0–6)** with small stable interfaces, then the business core (orders → attendance). Customers, vehicles and plates moved to Mostafa. Everyone else builds against the contract and mocks, so you never block them as long as the contract PR lands before the code.

### Your deliverables at a glance
| # | Feature | Phase / weeks | Others depend on it |
|---|---|---|---|
| 1 | Default-deny auth guard + `@Requires` RBAC + roles API | P1 · 2–4 | everyone (backend) |
| 2 | Crypto_Service (tenant envelope encryption + HMAC) | P1 · 2–3 | Mostafa (workers), Omar (face templates), Fares (payment refs) |
| 3 | Idempotency store + interceptor | P1 · 3 | Fares (payments), Mongi/Fares (offline) |
| 4 | Audit log with hash chain | P1 · 3–4 | everyone |
| 5 | Outbox + relay | P1 · 4–5 | Mostafa (WhatsApp, push), Fares (receipts) |
| 6 | Finish identity: password change/policy, 2FA, logout, forgot password, owner unlock | P1 · 2–6 | apps S2 |
| 7 | **Company side (built 24 Nov): Admin API, Admin Console, Public Website** — maintain + finish open items (section 14) | ongoing | everyone (station creation) |
| 9 | Orders API (state machine, items, assignees, timers, offline) | P4 · 12–16 | Fares checkout, apps 11–12 |
| 10 | Attendance API (check-in sequence, pings, board, corrections) | P6 · 19–23 | apps 03–06, 17 |
| 11 | Sync API for offline (P8) + pen-test fixes (P10) | 26–35 | apps |

---

## 1. Default-deny guard + RBAC (`@Requires`)

**Goal:** no route can ever be reached without an explicit decision. Today `Tenant_Context_Guard` is opt-in per route; a forgotten `@UseGuards` would expose data.

### Files
```
src/Common/Auth/Public_Decorator.ts        @Public()
src/Common/Auth/Requires_Decorator.ts      @Requires('orders.create', { scope: 'branch' })
src/Common/Auth/Access_Guard.ts            APP_GUARD: Public -> skip; else Tenant_Context_Guard + permission check
src/Common/Auth/Permission_Cache.ts        LRU (tenant,user,perm_version) -> Map<permission, scope>
src/Common/Auth/Current_Access.ts          currentAccess(): { permissions, branchIds, can(code, branchId?) }
src/Modules/Roles/Roles_Module.ts / Roles_Controller.ts / Roles_Service.ts
Database/Migrations/<ts>_Rbac_User_Branches.sql   (user_branches if not in workers module - agree with Mostafa)
```

### Logic
1. `Access_Guard` is registered as `APP_GUARD` **after** `ThrottlerGuard`.
2. Route has `@Public()` → allow (only `health`, `devices/bind`, `auth/login`, `auth/refresh`, `auth/mfa/verify`, `auth/password/forgot|reset`).
3. Otherwise run the existing tenant checks (JWT, station active, user active, perm_version, device). Then:
   - no `@Requires` on the route → **throw 500 `ROUTE_NOT_CLASSIFIED`** in dev/test, 403 in production (forces developers to decide).
   - load permissions: `SELECT rp.permission_code, rp.scope FROM user_roles ur JOIN role_permissions rp ...` inside `withTenant`; cache by `(tid, sub, perm_v)` for 60 s (perm_v changes invalidate automatically).
   - missing permission → 403 `PERMISSION_DENIED`.
4. Scope: `own` → service must filter `worker_id = current user`; `branch` → `branchIds` from `worker_branches` of the user; `all` → no filter. Services call `currentAccess().assertBranch(branchId)` which throws **404** (not 403) for a branch outside scope.

### Roles API (screen 21, S12)
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | /v1/permissions | roles.manage | global catalogue |
| GET | /v1/roles | roles.manage | with permission codes + scope |
| POST | /v1/roles | roles.manage | custom roles only if plan `custom_roles=true` (call `Plan_Limits.assert`, Mostafa) |
| PUT | /v1/roles/{id}/permissions | roles.manage | system role `owner` cannot be reduced; bump `perm_version` of every user with that role in the same transaction |
| DELETE | /v1/roles/{id} | roles.manage | only custom roles without users → else 409 `ROLE_IN_USE` |

### Security / logic checks
- The `owner` role must always keep every permission and every station must keep ≥ 1 active owner (block demoting the last owner → 409 `LAST_OWNER`).
- A user can never grant a permission they do not have (no privilege escalation through custom roles).
- Audit every role change with before/after permission lists.

### Tests
Unit: guard decisions table (public / no-requires / missing / scope). E2E: worker token calling `roles.manage` route → 403; owner of tenant B editing role of tenant A → 404; demote last owner → 409.

---

## 2. Crypto_Service — per-tenant envelope encryption (SEC-04)

### Tables (platform)
```sql
CREATE TABLE app.tenant_keys (
  tenant_id   uuid NOT NULL REFERENCES app.tenants(id),
  version     int  NOT NULL,
  wrapped_dek bytea NOT NULL,          -- data key encrypted by the KEK (KMS / master key)
  kek_ref     text NOT NULL,           -- 'env:v1' in dev, 'kms:arn:...' in prod
  created_at  timestamptz NOT NULL DEFAULT now(),
  retired_at  timestamptz,
  PRIMARY KEY (tenant_id, version)
);
-- app_rw: SELECT only. Insert/rotate via platform role.
```

### API of the service (used by everyone)
```ts
encrypt(tenantId, plaintext: Buffer|string, aad: string): Promise<Buffer>   // aad = 'customers.phone_e164'
decrypt(tenantId, blob: Buffer, aad: string): Promise<Buffer>
hmac(tenantId, value: string, purpose: 'phone'|'plate'|'phone_last4'): string  // hex, for exact-match search
```
- Format: `[1 byte key version][12 byte IV][16 byte GCM tag][ciphertext]`, AES-256-GCM, **AAD = tenantId + ':' + table.column** so a value copied to another row/tenant fails to decrypt.
- DEK: 32 random bytes per tenant; KEK in dev = `MASTER_KEY` env (32 bytes base64) — production = cloud KMS (AWS KMS / GCP KMS) `Decrypt` call; cache decrypted DEK in memory ≤ 5 min, never log it.
- HMAC key = HKDF(DEK, info = purpose). Searching a phone = normalise to E.164 first (`libphonenumber-js`, default region EG) then `hmac(...)`.
- **Crypto-shredding**: deleting all `tenant_keys` rows of a tenant makes every ENC column unreadable (PLT-06).
- Provision the first key when a tenant is created (Mostafa's platform API calls `Crypto_Service.createTenantKey`).

### Tests
Round trip; wrong AAD fails; wrong tenant fails; rotation (v1 data still decrypts after v2 is created); HMAC stable per tenant and different across tenants.

---

## 3. Idempotency (REL-03: zero duplicate money)

### Table
```sql
CREATE TABLE app.idempotency_keys (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  key text NOT NULL CHECK (length(key) BETWEEN 8 AND 100),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,              -- 'POST /v1/orders'
  request_hash text NOT NULL,          -- sha256 of canonical JSON body
  state text NOT NULL CHECK (state IN ('in_progress','done')),
  response_status int, response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, key)
);
SELECT app.enable_tenant_rls('app.idempotency_keys');
```

### `@Idempotent()` interceptor logic
1. Header `Idempotency-Key` missing → 400 `IDEMPOTENCY_KEY_REQUIRED`.
2. `INSERT ... (state='in_progress', expires_at=now()+24h) ON CONFLICT DO NOTHING RETURNING` in its own short transaction.
3. Conflict → read the row:
   - same `user_id + endpoint + request_hash` and `done` → **replay** stored status + body (header `Idempotent-Replayed: true`).
   - same key, different hash/endpoint/user → 422 `IDEMPOTENCY_KEY_REUSED`.
   - `in_progress` → 409 `REQUEST_IN_PROGRESS` (client retries after 1 s).
4. Run the handler. Success → update row `done` + response. Error 4xx → store too (deterministic); 5xx → **delete the row** so the client can retry.
5. Daily cleanup job deletes expired rows (Mostafa's job runner).
6. Second wall for money: `payments` has `UNIQUE(tenant_id, idempotency_key)` (Fares) and orders `UNIQUE(tenant_id, client_ref)`.

Apply on: `POST /orders`, `/orders/{id}/items`, `/orders/{id}/checkout`, `/orders/{id}/payments`, `/receipts/{id}/send`, `/workers`, `/imports/{id}/confirm`, `/attendance/check-in|check-out`.

---

## 4. Audit log with hash chain (SYS-02, SEC-10)

### Tables
```sql
CREATE TABLE app.audit_logs (
  id uuid PRIMARY KEY DEFAULT app.uuidv7(), tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  seq bigint NOT NULL, actor_user_id uuid, actor_type text NOT NULL,  -- user | system | platform_support
  action text NOT NULL, entity text NOT NULL, entity_id uuid,
  before jsonb, after jsonb, ip inet, device_id uuid, at timestamptz NOT NULL DEFAULT now(),
  prev_hash text NOT NULL, hash text NOT NULL, UNIQUE (tenant_id, seq), UNIQUE (tenant_id, id));
CREATE TABLE app.audit_chain_heads (tenant_id uuid PRIMARY KEY, last_seq bigint NOT NULL, last_hash text NOT NULL);
SELECT app.enable_tenant_rls('app.audit_logs'); SELECT app.enable_tenant_rls('app.audit_chain_heads');
REVOKE UPDATE, DELETE ON app.audit_logs FROM app_rw;
```

### `Audit_Service.record(db, entry)` — call it **inside the business transaction**
1. `SELECT last_seq, last_hash FROM audit_chain_heads WHERE tenant_id=$1 FOR UPDATE` (insert head with `'GENESIS'` if missing) — this serialises the chain per tenant only.
2. `hash = sha256(prev_hash + canonicalJson({seq, actor, action, entity, entity_id, before, after, at}))`.
3. Insert row + update head. If the business transaction rolls back, the audit row disappears too (correct).
4. **Redact** before storing: never store password hashes, OTPs, tokens, embeddings, full card refs; phone numbers stored masked (`+965 9xxx 1234`).
5. `GET /v1/audit-logs?entity=&actor=&from=&to=&cursor=` (`audit.view`, accountant sees finance entities only); `GET /v1/audit-logs/verify` recomputes the chain and returns the first broken `seq` (nightly job too).

---

## 5. Transactional outbox + relay

```sql
CREATE TABLE app.outbox_events (
  id uuid PRIMARY KEY DEFAULT app.uuidv7(), tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  type text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz, attempts int NOT NULL DEFAULT 0, last_error text);
SELECT app.enable_tenant_rls('app.outbox_events');
CREATE INDEX outbox_unpublished ON app.outbox_events (created_at) WHERE published_at IS NULL;
```
- `Outbox.add(db, type, payload)` inside the business transaction (events: `OrderCreated`, `OrderReadyForCheckout`, `OrderPaid`, `ReceiptIssued`, `CheckInConfirmed`, `CheckInRejected`, `WorkerLate`, `ImportFinished`).
- Relay = separate process `src/Workers/Outbox_Relay.ts`, DB role `outbox_relay` with an RLS policy that allows it to read/update **only** `outbox_events` (`USING (true)` for that role), loop: `SELECT ... WHERE published_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 100` → publish to RabbitMQ (`tenant_id` in message headers) → set `published_at`. Exponential backoff on errors; after 10 attempts → dead-letter + alert.
- Consumers (Mostafa's WhatsApp/push, Fares's receipt PDF) MUST call `Db_Client.withTenant(message.tenantId, ...)`; messages without `tenant_id` go to the dead-letter queue.
- Payload never contains personal data — only ids (consumers load the data under RLS).

---

## 6. Finish identity (AUTH-03, 05, 07, 08, owner unlock)

### 6.1 Password policy + forced change (S2)
- `POST /v1/auth/password/change {currentPassword, newPassword}` (@Requires none, any signed-in user).
- Policy: length ≥ tenant setting (default 8, max 128), not in top-10k common list (`Database/Data/Common_Passwords.txt`), not containing the username, not equal to the last 3 hashes (`password_history` table).
- On success: new Argon2id hash, `must_change_password=false`, **bump `perm_version`** (kills every access token) and revoke all refresh families except the current device's; issue fresh tokens.
- If `must_change_password=true` at login → return only a **restricted token** (`scp:["password_change"]`, 10 min); `Access_Guard` rejects it on every route except change-password.

### 6.2 2FA TOTP for owner + accountant (AUTH-05)
- `POST /v1/auth/mfa/setup` → secret (20 random bytes, stored with `Crypto_Service.encrypt(..., 'users.mfa_secret')`), returns `otpauth://` URI for the QR; `POST /v1/auth/mfa/enable {code}` confirms.
- Login of a user whose role requires MFA → response `{mfaRequired:true, mfaToken}` (JWT `scp:["mfa"]`, 5 min, bound to device) → `POST /v1/auth/mfa/verify {mfaToken, code}` → real tokens.
- TOTP window ±1 step; store `mfa_last_step` and reject a code from an already-used step (replay). 5 wrong codes → same lockout as passwords.
- Recovery: 8 one-time recovery codes (Argon2 hashed), shown once.

### 6.3 Logout / remote sign-out (AUTH-07)
- `POST /v1/auth/logout` → revoke current refresh family. `POST /v1/auth/logout-all` → revoke all + bump `perm_version`.
- `Session_Service.revokeDevice(userId, deviceId)` used by Mostafa's `DELETE /v1/workers/{id}/devices/{deviceId}`: sets `devices.revoked_at`, revokes families (the guard already rejects revoked devices).
- Optional 10 s grace on refresh reuse: if a token was rotated < 10 s ago from the same device and its child is unused, return the child pair instead of revoking (handles lost responses on bad 4G).

### 6.4 Forgot password (AUTH-08)
- Worker: owner resets via Mostafa's `POST /v1/workers/{id}/password-reset` (uses your `Password_Service.setTemporary`).
- Owner/accountant: `POST /v1/auth/password/forgot {stationCode, username}` → **always 202** (no account enumeration); if the user exists and has a verified phone → 6-digit OTP (hash stored, 10 min, max 5 tries) sent through Mostafa's `Messaging.sendOtp`. `POST /v1/auth/password/reset {stationCode, username, otp, newPassword}` → policy check, revoke all sessions. Throttle 3/hour per username + per IP.

### 6.5 Owner unlock
`POST /v1/users/{id}/unlock` (`workers.update`) inserts a `login_attempts` row `success=true, reason='owner_unlock'` — the lockout query already counts failures only after the last success.

---

## 9. Orders (ORD-01..10, VEH-05) — the business core

### State machine (only these transitions are legal)
```
in_progress --(all items done/removed, >=1 done: automatic)--> ready_for_checkout
ready_for_checkout --(item re-opened or added)--> in_progress
ready_for_checkout --(POST /checkout, Fares)--> awaiting_payment
awaiting_payment --(payment confirmed, Fares)--> paid
in_progress | ready_for_checkout --(POST /cancel, reason, orders.cancel, no payments)--> cancelled
paid --(refund, Fares)--> refunded
```
`Order_State.assertTransition(from, to)` in one file; every change inserts `order_status_history(from, to, by_user, at, reason)` and an outbox event. Updates use optimistic locking: `UPDATE ... WHERE id=$1 AND version=$2` → 0 rows → 409 `VERSION_CONFLICT` (clients send `If-Match: <version>`).

### Tables (migration `<ts>_Orders_Tables.sql`, spec DDL 9.11)
`orders`, `order_items` (+ `vehicle_part text`, `outcome text CHECK IN ('repaired','replaced','attention')`), `order_item_assignees`, `order_status_history`, `order_attachments`, `order_counters(tenant_id, branch_id, year, last_value)`.
Unique partial index `one_open_order_per_vehicle` and `UNIQUE(tenant_id, client_ref)`.

### Endpoints
| Method | Path | Permission | Key rules |
|---|---|---|---|
| POST | /v1/orders | orders.create | `@Idempotent`; body `{clientRef, branchId, plateScanId?, vehicleId | newVehicle{plate, make, model, year?, color?, bodyType?, customer{name, phone}}, problem, mileage?}`; `currentAccess().assertBranch(branchId)`; existing `clientRef` → return that order (200, offline sync); open order for the vehicle → 409 `VEHICLE_HAS_OPEN_ORDER` + `existingOrderId`; `entered_at = now()` (server clock, never client); order_no `<branch.receipt_prefix>-<yyyy>-<seq>` via `order_counters ... FOR UPDATE`; update `vehicles.last_mileage` only if higher |
| GET | /v1/orders?status=active&branch=&cursor= | orders.view | scope filter; active = not paid/cancelled/refunded; returns `enteredAt` + server `now` for timers |
| GET | /v1/orders/{id} | orders.view | items, assignees, totals, history |
| POST | /v1/orders/{id}/items | orders.create | order must be `in_progress`/`ready_for_checkout` (moves back to in_progress); `{serviceId, qty 1..99, assigneeIds[1..5], vehiclePart?}`; price + tax snapshot from Mostafa's `Catalog_Service.priceAt(serviceId, branchId, now)` (retired service → 422 `SERVICE_RETIRED`); assignees must be active workers of the order's branch |
| PATCH | /v1/orders/{id}/items/{itemId} | orders.create | qty, assignees; discount only with `finance.correct` or tenant setting `worker_discount_allowed`, `discount ≤ cap` (amount or %), reason required |
| POST | /v1/orders/{id}/items/{itemId}/finish | orders.create | caller must be an assignee or have branch scope; `{fixPerformed (1..2000 chars), outcome}`; sets finished_at, minutes_spent per assignee; auto transition when last item finished |
| DELETE | /v1/orders/{id}/items/{itemId} | orders.create | soft remove `{reason}` → status `removed` |
| POST | /v1/orders/{id}/attachments | orders.create | signed upload URL; kinds photo/voice; max 10 per order, 5 MB each |
| POST | /v1/orders/{id}/cancel | orders.cancel | reason required; refused if any payment exists |

### Money rules (shared with Fares — write `Money.ts` together in week 12)
- Prices in the catalog are **excluding tax**. `line_net = round2(unit_price × qty − discount)`, `line_tax = round2(line_net × rate / 100)`, totals = sums of lines (round half-up, 2 decimals). All math with `decimal.js`, never JS floats. Totals are recomputed on the server on every item change; client totals are display only.

### Tests that must exist
Two parallel `POST /orders` same vehicle → exactly one 201 + one 409; same `clientRef` twice → one order; tenant B cannot read/modify tenant A order (404); worker without branch scope → 404; illegal transition → 409; discount above cap → 422; totals match a fixture table of 20 cases.

---

## 10. Attendance (ATT-01..11) — most security-sensitive call

### Tables
`attendance_challenges(tenant_id, id, user_id, device_id, nonce_hash, type, prompts jsonb, expires_at, used_at)`, `attendance_attempts`, `attendance_records`, `location_pings`, `presence_intervals`, `attendance_corrections` (spec 9.5). `REVOKE UPDATE (check_in_at, check_out_at) ON attendance_records FROM app_rw` — corrections are separate rows; view `attendance_effective` applies them.

### Check-in sequence (spec 10.2) — implement exactly in this order
1. `POST /v1/attendance/challenge {type}` → 32-byte random nonce (store sha256), expires 60 s, plus 2 random liveness prompts and the station's active face/liveness versions + thresholds.
2. `POST /v1/attendance/check-in` (multipart, `@Idempotent`): `nonce, lat, lng, accuracyM, mockLocation, integrityToken, livenessDeviceScore, promptsPassed, frame (JPEG ≤ 300 KB, 1 face)`.
3. Server, every failure → `attendance_attempts` row with `reject_reason` and 422 with that code:
   1. consume nonce atomically: `UPDATE attendance_challenges SET used_at=now() WHERE nonce_hash=$1 AND user_id=$2 AND device_id=$3 AND used_at IS NULL AND expires_at>now() RETURNING` → none → `CHALLENGE_INVALID`.
   2. `Device_Integrity_Service.verify(platform, integrityToken, nonce)`: Android = Play Integrity server decode (verdict `MEETS_DEVICE_INTEGRITY`, package name, nonce match); iOS = App Attest assertion (Omar provides key registration) → `integrity`.
   3. `mockLocation=true` → `mock_location`; `accuracyM > 50` → `low_accuracy`.
   4. geofence: Haversine distance to each assigned branch center ≤ radius (or point-in-polygon) → none → `outside_area` (store distance).
   5. templates of THIS worker only (decrypt) → none → `no_template`.
   6. `Inference_Client.checkLiveness(tenant, frame)` ≥ station threshold, and `promptsPassed=true` → else `liveness_failed`.
   7. **server** computes the embedding from the frame (`Inference_Client.embedFace`) — never trust the client embedding — cosine vs each template ≥ threshold → else `face_mismatch`.
   8. open record exists → 409 `ALREADY_CHECKED_IN`; else create record (`check_in_at = now()`, `late_minutes` from schedule in tenant time zone).
   9. frame bytes are never written to disk/storage; discard after step 7.
4. Check-out: same steps, closes the record, computes `minutes_on_site` from presence intervals.

### Other endpoints
| Path | Notes |
|---|---|
| POST /v1/attendance/pings | batch ≤ 50, only while a record is open, at most 1 ping / 4 min accepted, server decides `inside` |
| GET /v1/attendance/board?date&branch | present / absent / late / on site / outside (owner, manager) |
| GET /v1/attendance/records?worker&from&to | own records for workers |
| POST /v1/attendance/records/{id}/corrections | `{field, newValue, reason}` owner/manager, audited, original untouched |
| POST /v1/attendance/manual-check-in | ATT-11 fallback: manager's device, `{workerId, reason}`, audited, flagged |
| job | auto-close open records at branch closing → `auto_closed` (job in Mostafa's runner, logic yours) |

Privacy (PRV-02): GPS stored encrypted; raw pings deleted after 90 days; pings only accepted between check-in and check-out.

---

## 11. Offline sync API (P8) and hardening (P10)
- `GET /v1/sync/orders?branch=&since=<cursor>` returns changed orders/items since cursor (`updated_at, id`), deletes as tombstones. Clients push with the normal idempotent endpoints using `clientRef`.
- P10: fix pen-test findings, run `npm audit`, review every `@Requires`, confirm `Db_Rls_Check` and cross-tenant suite cover all routes (generate the cross-tenant tests from the OpenAPI file).

## 12. Your weekly plan
| Week | Output (merged to main) |
|---|---|
| 1 | contract PRs for P1 endpoints; `Access_Guard` + `@Public/@Requires` |
| 2 | Crypto_Service + tenant_keys; roles API |
| 3 | Idempotency; audit chain |
| 4 | outbox + relay; password change + restricted token |
| 5 | 2FA; logout; forgot password; unlock |
| 6 | P1 hardening, cross-tenant tests for all identity routes |
| 7–9 | Admin Console open items: dashboard caching, support-access grants (with S9), billing basics |
| 10–12 | `Money.ts` with Fares; orders contract; website legal pages + sitemap |
| 13–16 | orders |
| 17–18 | help Fares integrate checkout; order events |
| 19–23 | attendance |
| 24–28 | reports support for Mostafa, sync API |
| 29–35 | performance (k6) fixes, pen-test fixes |

## 13. What you can hand over to avoid blocking others
- Week 1: publish TypeScript interfaces (`Audit_Service`, `Crypto_Service`, `Idempotent`, `Requires`) with no-op implementations so Mostafa / Fares / Omar compile immediately; replace with real code later — signatures never change.

## 14. Company side you own (built and verified 24 Nov 2026)
Specs: `08_Public_Website_Spec.pdf`, `09_Admin_Console_Spec.pdf`. Code: `Backend/src/Platform/`, `Backend/src/Modules/Public/`, `Web_Admin/`, `Web_Public/`, migrations `202611241000_Platform_Admin.sql`, `202611241200_Platform_Counts_Fix.sql`, test `Tests/Platform/Platform_Onboarding.spec.ts`.

### Already done
- Super Admin bootstrap command; staff sign-in with forced password change + mandatory TOTP 2FA; lockout; rotating sessions.
- Company RBAC: departments, 16 permissions, 5 system roles, custom roles, no privilege escalation, last Super Admin protected, every change audited (hash chain + verify).
- Station requests inbox; station creation in one transaction (roles, permissions, owner `invited`, 48-h single-use activation link); suspend / reactivate / schedule deletion / resend invitation; plans.
- Public website (AR/EN, RTL, animated sections), request form with honeypot + rate limit, owner activation page.
- Separation: own process/port, own DB role `platform_rw`, own JWT secret + audience, IP allowlist, BFF cookies, CSP.

### Still to do (priority order)
| # | Item | Why |
|---|---|---|
| 1 | SMS / WhatsApp provider for owner invitations (with Mostafa's `Messaging_Provider`) | production refuses the console provider |
| 2 | Cache `platform_tenant_counts()` (1 min) or keep `tenant_usage` updated by events | dashboard ~4–5 s on the remote DB |
| 3 | Create the station encryption key at station creation (after `Crypto_Service`) | PLT-02 |
| 4 | Support access grants (owner screen S9 + `/platform/v1/support-sessions`) with double audit | ADM-13 |
| 5 | Tenant deletion job (crypto-shredding + deletion certificate) and full station export | ADM-16, PLT-05/06 |
| 6 | Billing basics: invoice records, payment status, reminder, auto-suspend after grace period | ADM-14 |
| 7 | Website: privacy + terms pages, sitemap.xml, robots.txt, real app screenshots | WEB-07/08, SEO |
| 8 | Deploy: Admin API + Web_Admin behind VPN / IP allowlist; Web_Public on a CDN with HTTPS | ADM-OPS-01, WEB-OPS-01 |

### Rules learnt while building it
- On Supabase a `SECURITY DEFINER` function runs as the owner and **bypasses RLS** → always filter by `tenant_id` explicitly inside such functions (a real bug found in testing).
- Every new company table must `REVOKE ALL … FROM app_rw` (default privileges would otherwise grant it) — `Db_Rls_Check` fails if you forget.
- Never return activation links or temporary passwords for owners in production; staff temporary passwords are shown once to the creating admin only.
