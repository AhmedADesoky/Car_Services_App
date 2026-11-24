<div class="cover" markdown="1">
# Mostafa Tayar — Backend Platform + DevOps
<div class="meta">iOS team · Owner of the backend platform modules (workers, branches, customers, vehicles, plates, catalog, tax, accounting, reports, Excel, messaging, notifications, settings, plan limits) and of DevOps (environments, CI/CD, deploy, monitoring, backups).<br>Reviewer for: Ahmed Abdelsamad. Your reviewer: Ahmed Abdelsamad.</div>
<span class="badge">BACKEND PLATFORM · DEVOPS</span>
</div>

## 0. Rules you inherit from the core (Ahmed A.)
Every module uses: `Db_Client.inCurrentTenant`, `@Requires('<permission>')`, `@Idempotent()` on creates, `Audit_Service.record(db, …)` in the same transaction, `Outbox.add(db, …)` for side effects, `Crypto_Service` for ENC columns, zod validation, problem+json errors, cursor pagination. Migrations are named `YYYYMMDDHHMM_<Module>_<What>.sql`, every tenant table ends with `SELECT app.enable_tenant_rls('app.<table>')`.

### Deliverables
| # | Feature | Weeks |
|---|---|---|
| 1 | DevOps foundation: environments, CI, CODEOWNERS, secret scanning, deploy to dev | 0–3 |
| 2 | Plan limits enforcement (`Plan_Limits`) | 2–4 |
| 2b | **Customers, vehicles, plates API** (moved from Ahmed A.) | 9–14 |
| 3 | **Workers & branches (spec section 7, full)** | 6–9 |
| 4 | Catalog, prices, tax | 9–12 |
| 5 | Settings & integrations, job runner, notifications (push) | 12–16 |
| 6 | Messaging: WhatsApp per station + SMS/email fallback | 16–19 |
| 7 | Accounting (journal), reports & dashboards | 23–26 |
| 8 | Excel import / export, audit export, data export, tenant deletion | 26–28 |
| 9 | Load tests, monitoring, backups drill, production launch | 29–37 |

---

## 1. DevOps foundation (weeks 0–3)

### Environments
| Env | Supabase project | API host | Data |
|---|---|---|---|
| local | developer's own Supabase project or the shared dev project | `localhost:3000` | 3 seeded tenants |
| dev | `car-services-dev` | auto-deploy on merge to `main` | synthetic |
| staging | `car-services-staging` | deploy on tag `v*-rc*` | synthetic + anonymised volumes |
| production | `car-services-prod` (PITR add-on ON) | deploy on tag `v*` after approval | real |
Production data is never copied to other environments (spec 3.7).

### Hosting recommendation
Docker image (`Backend/Dockerfile`, multi-stage, `node:22-alpine`, non-root user, `npm ci --omit=dev`) deployed to a managed container service **in the same region as Supabase (eu-west-1, Ireland)**: AWS ECS Fargate / Google Cloud Run / Fly.io. 2 instances minimum (REL-01), health check `GET /v1/health`, rolling deploys (REL-05). HTTPS only at the load balancer with **HSTS** (`max-age=31536000; includeSubDomains`), TLS 1.2+ (SEC-03). Set `TRUST_PROXY=1`, `NODE_ENV=production`, `DB_SSL_CA_PATH` (the API refuses to start without it in production).

### Secrets (SEC-07)
Secrets only in the cloud secret manager (AWS Secrets Manager / GCP Secret Manager) and GitHub Actions secrets — never in the repo. Rotation every 90 days: JWT secret (support two secrets during rotation: sign with new, verify both — add `JWT_ACCESS_SECRET_PREVIOUS`), DB passwords, WhatsApp tokens.

### CI (`.github/workflows/`)
- `Backend_Ci.yml` (exists): add ESLint + Prettier, `npm audit --audit-level=critical` (SEC-08), coverage gate 70 % on domain code, `Db_Rls_Check`, cross-tenant suite against a CI Supabase project.
- `Security_Ci.yml`: **gitleaks** secret scanning on every PR, Trivy scan of the Docker image, Dependabot for npm / Gradle / SwiftPM / pip.
- `Android_Ci.yml` (exists) + `Ios_Ci.yml` (macOS runner, `xcodebuild test`, SwiftLint).
- `.github/CODEOWNERS` from the ownership table in the overview; branch protection on `main` (1 review from the other team + green CI).

### Observability (OBS-01)
OpenTelemetry traces + metrics, structured JSON logs with `tenant_id`, `request_id`, **no personal data** (pino redaction of `authorization`, `password`, `phone`, `otp`, `embedding`, `frame`). Sentry for backend and apps. Alerts: error rate > 1 %, p95 > 500 ms, outbox backlog > 5 min, WhatsApp failure > 5 %.

---

## 2. Plans & limits (`Plan_Limits` service)
The Admin API and Admin Console were built by Ahmed Abdelsamad (see `09_Admin_Console_Spec.pdf`). You own the **enforcement** of plan limits inside the station API:
`Plan_Limits.assert(tenantId, 'branches'|'workers'|'custom_roles'|'import')` and `consume(tenantId, 'plate_scans_month', 1)` = atomic `INSERT … ON CONFLICT (tenant_id, period) DO UPDATE SET plate_scans = tenant_usage.plate_scans + 1 RETURNING plate_scans`, compared with the plan limit → 402 `PLAN_LIMIT_REACHED`. Write `tenant_usage` with a dedicated role (`platform_rw` or a new `usage_rw`), never `app_rw` (migration 0004 revoked it).

## 3. Workers & branches — spec section 7 in full (highest priority, weeks 6–9)

### Tables
`branches` (name, address, phone, `geo_center_lat/lng numeric(9,6)`, `geofence_radius_m int CHECK 30..1000 DEFAULT 100`, `geofence_polygon jsonb`, `opening_hours jsonb`, `receipt_prefix text CHECK ~ '^[A-Z0-9-]{2,10}$'`, `is_active`), `worker_profiles` (spec 9.4, ENC: national_id, mobile, whatsapp, emergency_contact; `employee_code UNIQUE per tenant`), `worker_branches`, `worker_schedules` (weekday 0–6, start/end time, valid_from/to; no overlapping shifts per day), `worker_documents` (file in `tenants/{tid}/workers/{id}/docs/`, sha256, expires_on). Face templates are Omar's.

### Lifecycle rules (must be enforced on the server)
| Operation | Rules |
|---|---|
| Add (POST /v1/workers, `@Idempotent`) | `Plan_Limits.assert('workers')` (count of active + invited); username suggested from English name, unique in tenant; creates `users` row `invited` + `must_change_password=true` with a **random 12-char temporary password** or activation link sent by SMS/WhatsApp — never returned in the API response body to anyone but the owner's screen once |
| Edit (PATCH, `If-Match`) | owner/manager; worker may only edit own photo, phone, emergency contact, language; audited before/after |
| Change role | bump `perm_version` (tokens die immediately); cannot remove the last owner |
| Branches / schedule | changes apply from the next day unless `immediate=true` |
| Reset password | new temporary password, revoke all sessions (`Session_Service`) |
| Suspend / reactivate | suspend revokes sessions now |
| Deactivate | `endDate` + `reason`; body must reassign **every** open order item of that worker (`reassign:[{itemId, toWorkerId}]`) — any left → 409 `HAS_OPEN_ITEMS` with the list; revoke sessions + devices; schedule face template deletion in 30 days (Omar's service); frees the seat |
| Anonymise | only ≥ 30 days after deactivation or legal request; `{confirm:true}`; name → `Former worker #1234`, all ENC fields nulled, documents deleted, history kept |
| Hard delete | only if no attendance, orders, payments, audit entries → else 409 `HAS_HISTORY` |
| Transfer branch | keeps history; new geofence from next check-in |
| Devices | `GET /v1/workers/{id}/devices`, `DELETE …/devices/{deviceId}` → `Session_Service.revokeDevice` |

Endpoints: exactly the list in spec 7.5 (`/v1/workers…`, `/v1/me`). National ID and pay info are returned **only** to owner / accountant (column-level filtering in the service + separate DTOs, never one DTO with nulls).

### Branches (BR-01..04)
`GET/POST /v1/branches`, `PATCH /v1/branches/{id}`, `PUT /v1/branches/{id}/geofence` (validate polygon: 3–50 points, not self-intersecting, area < 1 km²). `Plan_Limits.assert('branches')`.

---

## 3b. Customers + vehicles (CUS-01..06, VEH-07..10) — screens 08, 09, 10, 22

### Tables (migration `<ts>_Customers_Vehicles.sql`)
```sql
customers(id, tenant_id, name text NOT NULL, name_normalized text, phone_e164 bytea /*ENC*/, phone_hash text,
          phone_last4_hash text, preferred_locale text CHECK IN ('ar','en'), whatsapp_opt_in bool DEFAULT false,
          opt_in_at timestamptz, notes text, merged_into_id uuid, anonymized_at timestamptz, created_at, updated_at,
          created_by, version int, UNIQUE(tenant_id,id), UNIQUE(tenant_id, phone_hash))
vehicles(id, tenant_id, plate_display text, plate_normalized text NOT NULL, plate_country text DEFAULT 'EG',
         plate_type text CHECK IN ('private','taxi','transport','commercial','other'), make, model, year int,
         color text, body_type text CHECK IN ('sedan','suv','hatchback','pickup','van'), vin text,
         current_customer_id uuid, last_mileage int, UNIQUE(tenant_id, plate_normalized), ...)
vehicle_ownerships(tenant_id, vehicle_id, customer_id, from_date, to_date)
CREATE INDEX customers_name_trgm ON app.customers USING gin (name_normalized extensions.gin_trgm_ops);
```
### Endpoints
| Method | Path | Permission | Rules |
|---|---|---|---|
| GET | /v1/customers?q= | customers.view | `q` → if it parses as a phone: exact `phone_hash`; if 4 digits: `phone_last4_hash`; if it parses as a plate: vehicles.plate_normalized prefix; else name trigram (`similarity > 0.3`). Max 50, cursor |
| POST | /v1/customers | customers.create | normalise phone (E.164, region EG); duplicate phone → 409 `CUSTOMER_EXISTS` with existing id |
| GET/PATCH | /v1/customers/{id} | view / create | profile: vehicles, visits, receipts, payments, total spend (sum of paid orders) |
| POST | /v1/customers/{id}/merge {intoId} | customers.delete | same tenant; move vehicles + ownerships to target, set `merged_into_id`, orders keep their original customer_id (history) but listing follows the merge; audit |
| POST | /v1/customers/{id}/anonymize | customers.delete | name → `Former customer #<last 6 of id>`, phone/notes nulled, opt-in false; totals kept (CUS-06) |
| GET | /v1/vehicles?plate= | customers.view | normalised exact match → returning-car screen 09 |
| POST | /v1/vehicles | customers.create | `plate_normalized` via `Plate_Normalizer` rules (port the Python table to TS — same tests) |
| GET | /v1/vehicles/{id}/history | orders.view | orders newest first: date, problem, diagnosis, fix, status, worked by, amount; `hasPendingFollowUp` banner flag (VEH-08) |
| GET | /v1/vehicles/{id}/parts-map | orders.view | for the 2D car map: latest outcome per part id (`fb, hood, eng, roof, dfl, drl, dfr, drr, trunk, rb, wfl, wfr, wrl, wrr`) + history per part |
| POST | /v1/vehicles/{id}/transfer {toCustomerId} | customers.create | closes current ownership row, opens new one; history stays with the vehicle (VEH-09) |

> Phone search is **exact full number or last 4 digits** — free partial search is impossible on encrypted phones and would need plaintext. This is a deliberate privacy decision (tell the owner).

WhatsApp consent (CUS-05): `whatsapp_opt_in` + `opt_in_at` + who recorded it; Mostafa's messaging refuses to send when false.

---

## 3c. Plates API (VEH-01..04) — with the AI pair

| Method | Path | Rules |
|---|---|---|
| POST | /v1/plates/recognize | multipart `image` JPEG ≤ 1.5 MB, ≤ 1280 px; check plan quota (`Plan_Limits.consume('plate_scans_month')`); call `Inference_Client.recognizePlate(tenantId, image)` (Omar) with 2 s timeout; on timeout → 503 `AI_UNAVAILABLE` (app falls back to manual entry, REL-04). Image is NOT stored here |
| POST | /v1/plates/scans | `{predictedText, finalText, confidence, modelVersion, ranOn:'device'|'server', imageUploadId?}` → normalise; `was_corrected = normalize(predicted) != normalize(final)`; if corrected and `imageUploadId` given → create `ai_training_samples` row (Omar's table) with `consent_scope='tenant_only'` |
| POST | /v1/uploads/plate-image | returns a signed upload URL `tenants/{tid}/plates/{uuid}.jpg` valid 5 min (Supabase Storage, private bucket), only used when the worker corrected the plate |

Retention: plate images deleted after 90 days (your job runner) unless referenced by a training sample still in use.

---

> These modules moved from Ahmed Abdelsamad to you on 24 Nov 2026 (Ahmed now owns the Admin Console, the Admin API and both websites). Orders (Ahmed) call your `Customers_Service` / `Vehicles_Service`; agree the interfaces in week 1.

## 4. Catalog, prices, tax (CAT-01..05)
- `service_categories`, `services`, `service_prices(service_id, branch_id NULL, price numeric(12,2) CHECK ≥ 0, currency, effective_from, effective_to, set_by)` with **`EXCLUDE USING gist (tenant_id WITH =, service_id WITH =, coalesce(branch_id, '00000000-…') WITH =, tstzrange(effective_from, effective_to) WITH &&)`** (needs `btree_gist`) so two prices never overlap; `tax_rates` versioned the same way.
- New price = close the current range at `effective_from` and insert the new row in one transaction; old orders keep their snapshot (CAT-02).
- `Catalog_Service.priceAt(serviceId, branchId, at)` → branch price if any else general price + tax rate for the service's tax category at that moment — used by Ahmed A.'s orders.
- Retire: `retired_at`, hidden from new orders (422 `SERVICE_RETIRED`), kept in history.

## 5. Settings, integrations, jobs, push (SYS-01, SYS-03)
- `tenant_settings(key, value jsonb)` with a zod schema per key (languages, currency, receipt template, numbering, retention days, discount cap, geofence defaults, `worker_discount_allowed`, `arabic_indic_digits`).
- `integrations(type, config jsonb, secret bytea ENC, status, last_checked_at)`: `PUT /v1/integrations/{type}` encrypts secrets with `Crypto_Service`; secrets are **write-only** (never returned; the API shows `•••• last 4`).
- Job runner: **pg-boss** (Postgres-based, no extra infra) or BullMQ on Redis — jobs: idempotency cleanup, location ping retention (90 days), plate image retention, attendance auto-close (Ahmed A.'s logic), face template deletion (Omar), import file cleanup (7 days), audit chain verification nightly. Jobs always run per tenant inside `withTenant`.
- Push (SYS-01): `push_tokens(device_id, token ENC, platform)`, FCM for Android, APNs for iOS; consumer of outbox events; text never contains customer data.

## 6. Messaging: WhatsApp per station (CHK-03..05)
- WhatsApp Business **Cloud API**: each station stores its own `phone_number_id` + access token (encrypted). Approved templates per locale in `message_templates`.
- Send = consumer of `ReceiptIssued` / explicit send request: check customer `whatsapp_opt_in`, create `message_deliveries` (`idempotency_key UNIQUE` → a retry never sends twice), call the Graph API with the receipt PDF link (signed URL valid 7 days or media upload), status `queued → sent`.
- **Webhook** `POST /v1/webhooks/whatsapp` (`@Public`): verify `X-Hub-Signature-256` HMAC with the app secret **before parsing**; map `phone_number_id → tenant` through a platform lookup table; update delivery status (`delivered`, `read`, `failed`); unknown ids ignored. Respond 200 fast; process async.
- Fallback (CHK-05): after `failed` or 5 min without `sent` → SMS provider (`Messaging_Provider` interface: `console` in dev, an Egyptian SMS gateway in prod) then email.
- `Messaging.sendOtp(phone, code)` for Ahmed A.'s forgot-password flow.

## 7. Accounting, reports, dashboards (ACC-01..05, REP-01..04)
- Seed `ledger_accounts` per tenant: 1000 Cash, 1010 Card clearing, 2100 Tax payable, 4000 Service revenue, 4900 Discounts.
- Consumer of `OrderPaid`: one balanced journal entry per payment method (Dr Cash / Card clearing; Cr Revenue; Cr Tax payable), `UNIQUE(tenant_id, source_type, source_id)` so a replayed event never double-posts; deferred constraint trigger checks Σdebit = Σcredit.
- `PaymentRefunded` → reversing entry. Accountant: `GET /v1/journal-entries`, `POST …/{id}/confirm`, `POST /v1/corrections` (reversal + new entry, reason), `POST /v1/periods/{yyyy-mm}/lock` → any posting dated in a locked period → 409 `PERIOD_LOCKED`.
- Dashboards: `GET /v1/dashboard/owner`, `/dashboard/finance`, `/workers/{id}/performance`, `/reports/{type}?from&to&branch&format=json|xlsx|pdf`. Use daily aggregate tables refreshed by job (`daily_sales`, `daily_attendance`) + indexes starting with `tenant_id`; PERF-04: < 2 s for 12 months of one station.

## 8. Excel import / export (XLS-01..05), data export, deletion
- `exceljs`. Templates per kind (customers, vehicles, services, workers, opening history).
- Upload (≤ 10 MB, ≤ 10,000 rows, `.xlsx` only, check magic bytes) → `import_jobs` + `import_rows` with per-row errors and action create/update/skip → preview counts → **confirm in one transaction** → undo within 24 h if no new data depends on the rows. Tenant columns in files are ignored (XLS-05).
- **CSV/Excel formula injection**: on export, prefix any cell starting with `= + - @ \t \r` with `'`.
- Export jobs write to `tenants/{tid}/exports/` and are deleted after 7 days; download via signed URL.
- PLT-05 full station export (Excel + JSON + receipt PDFs) as a zip job.

## 9. Performance, backups, launch (weeks 29–37)
- k6 scripts: 300 req/s sustained, 1,000 burst (SCL-02); noisy-neighbour test: one tenant at 10× must not raise others' p95 > 20 % (SCL-04) → Redis-backed throttler storage + per-tenant rate limits.
- Backups: Supabase PITR (RPO 15 min), monthly restore drill into staging (REL-02), per-tenant logical export tool.
- Runbooks: incident, per-tenant restore, key rotation, tenant suspension/deletion, WhatsApp template rejection, model rollback.

## 10. Weekly plan
| Week | Output |
|---|---|
| 0–3 | Dockerfile, dev deploy, CI gates, gitleaks, Dependabot, CODEOWNERS, branch protection, Sentry |
| 3–5 | plan limits; messaging provider interface (owner invitations need SMS) |
| 6–9 | workers + branches (all of section 7 except face) |
| 9–14 | catalog, prices, tax; customers, vehicles, plates API |
| 12–16 | settings, integrations, job runner, push |
| 16–19 | WhatsApp + webhook + SMS fallback |
| 19–23 | staging + monitoring dashboards; help Ahmed A. with attendance jobs |
| 23–26 | accounting + reports + dashboards |
| 26–28 | Excel, exports, deletion, support access |
| 29–37 | k6, backups drill, production, runbooks |
