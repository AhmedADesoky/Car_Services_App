<div class="cover" markdown="1">
# Team Overview — Car_Services_App
<div class="meta">Vehicle Service SaaS · Android (Kotlin/Compose) · iOS (SwiftUI) · NestJS + Supabase · 3 AI models<br>Version 1.0 · 23 Nov 2026 · Read this first, then your own PDF.</div>
<span class="badge">ALL 6 MEMBERS</span>
</div>

## 0. What to start with (updated 24 Nov 2026)

The company side is now built and verified end-to-end: **Admin Console + Admin API + Public Website**. A real station can be created without the seed script: **public request → Super Admin approves → station + owner invitation → owner activates on the website → owner signs in on the phone.**

**Order of work from today (everyone in parallel):**
1. **Everyone, day 1:** pull `main`, run all four servers (section 2.3), create your own Super Admin account and create a test station through the Admin Console. Stop using the seed script for manual testing (it stays for automated tests).
2. **Ahmed Abdelsamad (core):** station-side identity that the real chain needs next → forced password change + restricted token, **2FA for owners**, RBAC guard `@Requires`, audit, idempotency, Crypto_Service (weeks 1–4). Then orders + attendance.
3. **Mostafa:** branches + workers API so an activated owner can **add workers** (weeks 1–6), then customers / vehicles / plates.
4. **Mongi (Android) + Fares (iOS):** S2 (change password + 2FA set-up), QR binding, then S3/S4/W1/W2 so the owner can set up the station on the phone.
5. **Abdelrahman + Omar:** AI track (separate PDF) + camera / location / integrity modules with fake engines.

**Milestone 1 (end of week 6):** an owner created in the Admin Console sets up a branch and adds a worker on Android and iOS; the worker signs in. That is the first fully real chain on phones.

**Real station data** only goes into the separate **production** project after the security gate in `10_Mobile_App_Spec.pdf` (encryption, audit, 2FA, pinning, backups, pen test, worker consent).

## 1. Documents in this pack

| PDF | For | Focus |
|---|---|---|
| `00_Team_Overview.pdf` | everyone | how to run, status of every requirement, ownership, workflow, rules |
| `01_Ahmed_Abdelsamad_Tasks.pdf` | Ahmed Abdelsamad | **CORE**: backend core, identity, RBAC, audit, orders, attendance |
| `02_Fares_Wael_Tasks.pdf` | Fares Wael | **CORE**: iOS app architecture + core flows, money backend (checkout, receipts, payments) |
| `03_Ahmed_Mongi_Tasks.pdf` | Ahmed Mongi | Android app: all screens, offline database, sync |
| `04_Mostafa_Tayar_Tasks.pdf` | Mostafa Tayar | backend platform modules + DevOps |
| `05_Abdelrahman_Hisham_Tasks.pdf` | Abdelrahman Hisham | Android AI runtime, camera, location, check-in UI |
| `06_Omar_Mohamed_Tasks.pdf` | Omar Mohamed | iOS AI runtime, location, check-in UI, AI registry + inference service |
| `07_AI_Models_Work_Plan.pdf` | Abdelrahman + Omar | the three models (separate track) + deployment decision |
| `08_Public_Website_Spec.pdf` | Ahmed Abdelsamad (owner), everyone (read) | public site: sections, motion, request form, owner activation, FR / NFR, data |
| `09_Admin_Console_Spec.pdf` | Ahmed Abdelsamad (owner), everyone (read) | company console: RBAC for departments, full schema, API, screens, FR / NFR |
| `10_Mobile_App_Spec.pdf` | all app + API developers | mobile FR / NFR with status + owners, **full station database schema**, screen inventory, contract rules |

---

## 2. Run the project yourself (Windows)

### 2.1 One-time installs
| Tool | Version | Where |
|---|---|---|
| Git | 2.4x | git-scm.com |
| Node.js | 22 LTS | nodejs.org |
| Android Studio | 2026.1 or newer (bundled JBR 21) | developer.android.com/studio |
| Python | 3.11 / 3.12 (AI notebooks only) | python.org |
| Xcode 16+ on a Mac | iOS team only | App Store |

### 2.2 Get the code
```powershell
git clone https://github.com/AhmedADesoky/Car_Services_App.git C:\Car_Services_App
cd C:\Car_Services_App
git checkout main
git pull
```

### 2.3 Backend (NestJS + Supabase)
1. Open `Backend\.env` (copy from `.env.example` if it does not exist) and fill:
   - `YOUR-DATABASE-PASSWORD` → Supabase → Project Settings → Database → password.
   - `SUPABASE_SECRET_KEY` → **a newly created secret key** (the old one was shared in a chat; revoke it).
   - `APP_DB_PASSWORD` + the same value inside `DATABASE_URL` → any long random password (it creates the API's DB role).
   - `JWT_ACCESS_SECRET` → 64 random characters.
2. Run, in a terminal:
```powershell
cd C:\Car_Services_App\Backend
npm install
npm run Db_Migrate
npm run Db_Rls_Check
npm run Db_Seed
npm run start:dev
```
3. Check in a second terminal:
```powershell
curl http://localhost:3000/v1/health
```
Expected: `{"status":"ok","db":"up",...}`. Tests: `npm test` (all) · `npm run test:isolation` (needs the DB).

> Only ONE person runs `Db_Migrate` against the shared dev database after each merged migration (the module owner who merged it). Everyone else only runs `npm run start:dev`. See section 6.4.

### 2.3b Admin Console + Public Website (company side)
Four terminals (or use the Browser pane launch configs in `.claude/launch.json`):
```powershell
cd C:\Car_Services_App\Backend; npm run start:dev
```
```powershell
cd C:\Car_Services_App\Backend; npm run start:platform
```
```powershell
cd C:\Car_Services_App\Web_Admin; npm install; npm run dev
```
```powershell
cd C:\Car_Services_App\Web_Public; npm install; npm run dev
```
| Server | URL |
|---|---|
| Station API (apps + public endpoints) | http://localhost:3000/v1 |
| Admin API (only the admin website calls it) | http://127.0.0.1:3001/platform/v1 |
| Public website | http://localhost:3002 |
| Admin console | http://localhost:3003 |

Create your company Super Admin once (prints a temporary password, you change it and set up 2FA at first sign-in):
```powershell
cd C:\Car_Services_App\Backend; npm run Platform_Create_Super_Admin -- --email you@company.com --name "Your Name"
```
Then: public site → "Request your station" → Admin Console → Station requests → **Approve & create station** → in development the activation link is shown in the success dialog (and printed in the Station API log) → open it → choose the owner password → sign in on the phone with the new station code.

### 2.4 Android app (Android Studio)
1. Android Studio → **Open** → `C:\Car_Services_App\Android_App` → **Trust Project**.
2. Settings → Build, Execution, Deployment → Build Tools → Gradle → **Gradle JDK = jbr-21**.
3. Wait for "Gradle sync finished".
4. **Device Manager** → ▶ on *Pixel_8* (or create any API 34+ phone).
5. Make sure the backend runs (2.3).
6. Toolbar → configuration **App** → ▶ **Run**.
7. In the app: station code `ALNOUR` → username `karim.adel` → password = `SEED_USER_PASSWORD` from `Backend\.env`. Home shows "Good morning, Karim Adel" and "Al-Nour Auto Service" — that proves app → backend → Supabase works.

> Rule for every screen: no server / database / debug information is ever shown in the apps (not even in debug builds). Developers check the server with `curl http://localhost:3000/v1/health` and the backend logs.

Real phone instead of the emulator: connect USB (Developer options → USB debugging), run `ipconfig` and put your PC's Wi-Fi IPv4 into `App/build.gradle.kts` → `debug { buildConfigField("String","BASE_URL","\"http://<IP>:3000/v1/\"") }`, and allow Node.js through Windows Firewall (private networks).

Command line build (optional):
```powershell
cd C:\Car_Services_App\Android_App
.\gradlew.bat assembleDebug
```
If you see `Unable to establish loopback connection`:
```powershell
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=C:\Car_Services_App\Android_App\.gradle\tmp"
```

### 2.5 API mock server (lets apps work before the backend endpoint exists)
```powershell
npx @stoplight/prism-cli mock C:\Car_Services_App\Api_Contract\Open_Api.yaml -p 4010
```
Point a debug build to `http://10.0.2.2:4010/` to get example responses from the contract.

### 2.6 Rebuild these PDFs
```powershell
pip install markdown
python C:\Car_Services_App\Docs\Team_Plan\Build_Pdfs.py
```

---

## 3. What is finished and what is not

Legend: [DONE] works and is tested · [PARTIAL] started, more work listed in the owner's PDF · [TODO] not started.

### 3.1 Functional requirements

| Area | ID | Requirement (short) | Status | Owner |
|---|---|---|---|---|
| Platform | PLT-01 | create tenant (name, tax no, currency, code…) | [DONE] Admin Console + API | Ahmed A. |
| | PLT-02 | auto-provision key, prefix, roles, settings, invite | [PARTIAL] prefix, roles, owner invite done; encryption key + settings todo | Ahmed A. |
| | PLT-03 | change plan / suspend / reactivate / schedule deletion | [DONE] (deletion job todo) | Ahmed A. |
| | PLT-04 | enforce plan limits | [TODO] `Plan_Limits` service | Mostafa |
| | PLT-05..09 | export, deletion, support access, platform dashboard, silo | [PARTIAL] dashboard done; others todo | Ahmed A. / Mostafa |
| Company | ADM-01..12 | Admin Console: staff 2FA sign-in, company RBAC, requests, stations, plans, audit | [DONE] | Ahmed A. |
| Website | WEB-01..06 | public site AR/EN, request form, owner activation | [DONE] | Ahmed A. |
| Auth | AUTH-01 | device binding with station code / QR | [PARTIAL] code works, QR scan missing | Ahmed A. (API) · Mongi/Fares (UI) |
| | AUTH-02 | login station + username + password (Argon2id) | [DONE] | Ahmed A. |
| | AUTH-03 | password policy, forced change on first login | [TODO] | Ahmed A. |
| | AUTH-04 | lockout 5 attempts / 15 min, attempts logged | [DONE] owner unlock missing | Ahmed A. |
| | AUTH-05 | 2FA for owner / accountant | [TODO] | Ahmed A. |
| | AUTH-06 | biometric quick unlock | [TODO] | Mongi / Fares |
| | AUTH-07 | 15-min access, 30-day rotating device-bound refresh, logout, remote sign-out | [PARTIAL] tokens + rotation + reuse detection done; logout endpoints missing | Ahmed A. |
| | AUTH-08 | forgot password flows | [TODO] | Ahmed A. |
| Branches | BR-01..04 | branches, geofence, overrides, worker branches | [TODO] | Mostafa (API) |
| Attendance | ATT-01..11 | face + location check-in/out, pings, board, corrections | [TODO] | Ahmed A. (API) · Abdelrahman/Omar (apps) |
| Plates & vehicles | VEH-01..10 | scan, Egyptian format, fallback, corrections, history | [TODO] (`Plate_Normalizer` ready) | Mostafa (API) · Abdelrahman/Omar (scan) |
| Customers | CUS-01..06 | profile, search, merge, consent, anonymise | [TODO] | Mostafa |
| Orders | ORD-01..10 | order, items, assignees, status flow, timers, offline | [TODO] | Ahmed A. |
| Catalog | CAT-01..05 | services, price history, tax versions | [TODO] | Mostafa |
| Checkout | CHK-01..07 | receipt, gap-free numbers, PDF, WhatsApp, delivery status | [TODO] | Fares (receipts) · Mostafa (WhatsApp) |
| Payments | PAY-01..06 | cash/card, split, refunds, cash drawer | [TODO] | Fares |
| Accounting | ACC-01..05 | journal entries, confirm, reports, period lock, export | [TODO] | Mostafa |
| Reports | REP-01..04 | owner / employee / finance dashboards | [TODO] | Mostafa (API) · Mongi/Fares (UI) |
| Excel | XLS-01..05 | templates, validate, confirm, undo, export | [TODO] | Mostafa |
| System | SYS-01 | push notifications | [TODO] | Mostafa |
| | SYS-02 | hash-chained audit log | [TODO] | Ahmed A. |
| | SYS-03 | tenant settings | [TODO] | Mostafa |
| | SYS-04 | Arabic / English + RTL | [PARTIAL] done on Android Bind/Login/Home | all app devs |
| AI | AI-01..06 | per-tenant model versions, fine-tune, AI page, packages | [TODO] | Omar + Abdelrahman |
| Workers | Section 7 | full worker lifecycle W1–W7 + API | [TODO] | Mostafa (API) · Mongi/Fares (UI) · Abdelrahman/Omar (W4 face) |

### 3.2 Non-functional requirements

| ID | Requirement | Status | Notes / owner |
|---|---|---|---|
| SEC-01 | zero cross-tenant access | [PARTIAL] | RLS + `Cross_Tenant_Isolation.spec.ts` + `Tenant_Context.spec.ts`; must grow with every endpoint (all) |
| SEC-02 | RLS on all tenant tables | [DONE] | `Db_Rls_Check` gate; keep it green (all) |
| SEC-03 | TLS 1.2+, HSTS, pinning | [PARTIAL] | DB TLS + CA check, Helmet headers; HTTPS/HSTS at deploy (Mostafa), pinning in apps (Mongi, Fares) |
| SEC-04 | encryption at rest + tenant-key field encryption | [TODO] | `Crypto_Service` (Ahmed A.) |
| SEC-05 | Argon2id 64 MB / 3 iterations | [DONE] | argon2 defaults = 64 MB, t=3 |
| SEC-06 | OWASP ASVS L2 / MASVS L2 | [PARTIAL] | rate limits, validation, problem+json, JWT pinned; checklist in each PDF |
| SEC-07 | secrets management, 90-day rotation | [PARTIAL] | `.env` git-ignored; CI secret scanning + vault (Mostafa) |
| SEC-08 | no critical dependency CVEs | [TODO] | Dependabot + `npm audit` gate (Mostafa) |
| SEC-09 | Play Integrity / App Attest | [TODO] | Abdelrahman (Android), Omar (iOS), verify on server (Ahmed A.) |
| SEC-10 | 100 % audit + hash chain | [TODO] | Ahmed A. |
| PRV-01..05 | biometric/location minimisation, PDPL 151/2020, DSR, residency | [TODO] | Omar/Abdelrahman (data), Mostafa (retention jobs), owner (legal) |
| PERF-01..07 | latency, plate < 1.5 s, check-in < 4 s, etc. | [TODO] | k6 tests (Mostafa), device benchmarks (AI pair) |
| SCL-01..04 | scale, peak load, autoscale, noisy neighbour | [PARTIAL] | stateless API + per-IP limits; per-tenant quotas (Mostafa) |
| REL-01..06 | 99.9 %, backups, no duplicate money, degradation, offline | [PARTIAL] | Idempotency-Key sent by Android; server store (Ahmed A.); backups (Mostafa) |
| AI-Q1..Q5 | model accuracy, fairness, size | [TODO] | AI pack |
| UX-01 | AR/EN switchable | [PARTIAL] | Android done for 3 screens |
| UX-02..05 | speed, accessibility, workshop use, same tokens | [PARTIAL] | `Design_Tokens.json` done |
| CMP-01 | Android 8.0+ | [DONE] | minSdk 26 |
| CMP-02 | iOS 17+ | [TODO] | Fares |
| MNT-01 | coverage, linters | [TODO] | each owner; gates by Mostafa |
| MNT-02 | OpenAPI current | [PARTIAL] | v0 contract; every owner updates it |
| OBS-01/02 | monitoring, crash-free | [TODO] | Mostafa (backend), Mongi/Fares (Crashlytics/Sentry) |

### 3.3 Security review already done on the current code
Fixed in this review (all covered by tests or builds):
1. A **suspended station's tokens kept working** for up to 15 min → the guard now re-checks station status, user status, permission version and device revocation on every request (`Tenant_Context.spec.ts`).
2. Request context now uses `AsyncLocalStorage.run()` per request (no possibility of context leaking between requests).
3. JWT algorithm pinned to **HS256** + issuer check; `alg=none` and forged tokens are rejected (tested).
4. **Rate limits**: 120 req/min/IP global, login 10/min, refresh 30/min, device bind 5/min, and max 30 never-used devices per station per hour.
5. **Helmet** security headers; `x-powered-by` removed.
6. Supabase TLS certificate verification via `DB_SSL_CA_PATH` (**mandatory in production**, the server refuses to start without it).
7. Migration `0004_Security_Hardening.sql`: the API role can only read safe columns of `tenants` (no KMS refs, DB routes), no access to usage metering, cannot delete refresh tokens.
8. Lockout now counts failures **since the last successful login** (old failures no longer lock a user who just signed in).
9. Refresh is refused for suspended stations.
10. Android: kotlinx-serialization dropped default fields (`platform`) → requests were rejected; fixed with `encodeDefaults`. Release builds set `FLAG_SECURE`.

Known accepted risks (tracked): refresh-token reuse detection logs out a user whose refresh response was lost on a bad network (standard behaviour; a 10-second grace period may be added, Ahmed A.); lockout by username can be abused to lock a worker out for 15 minutes (owner unlock + per-IP limit mitigate, Ahmed A.).

---

## 4. Ownership map (who owns which code)

| Area | Owner | Reviewer (other team) |
|---|---|---|
| `Backend/src/Common/**`, Auth, RBAC, Audit, Idempotency, Outbox | **Ahmed Abdelsamad** | Mostafa |
| Backend Orders, Attendance | **Ahmed Abdelsamad** | Fares |
| **Admin API (`Backend/src/Platform`), `Web_Admin/`, `Web_Public/`, public endpoints** | **Ahmed Abdelsamad** | Mostafa |
| Backend Checkout, Receipts, Payments, Cash closures | **Fares Wael** | Ahmed A. |
| Backend Workers, Branches, **Customers, Vehicles, Plates**, Catalog, Tax, Accounting, Reports, Excel, Messaging, Settings, Plan limits, DevOps | Mostafa Tayar | Ahmed A. |
| Backend AI module (registry, packages, inference client) + `AI_Models/Inference_Service` | Omar Mohamed | Abdelrahman |
| `iOS_App/**` architecture + all iOS screens except AI/camera/location | **Fares Wael** | Ahmed Mongi |
| iOS `AI_Kit`, `Location`, scan + check-in + face-enrollment screens | Omar Mohamed | Fares |
| `Android_App/**` architecture + all Android screens except AI/camera/location | Ahmed Mongi | Fares |
| Android `Core_Ai`, `Core_Location`, scan + check-in + face-enrollment screens | Abdelrahman Hisham | Ahmed Mongi |
| `AI_Models/**` notebooks | Abdelrahman (plate, face) · Omar (liveness, registry) | each other |
| `Api_Contract/**` | each module owner for their paths | one reviewer from each platform |

Add this to `.github/CODEOWNERS` (Mostafa, week 1) so GitHub requests the right reviewer automatically.

---

## 5. Timeline (phases from the spec, everyone in parallel)

| Weeks | Phase | Ahmed A. | Fares | Mongi | Mostafa | Abdelrahman | Omar |
|---|---|---|---|---|---|---|---|
| 0–2 | P0 | finish auth core | iOS project + design system | Hilt, Room, CI | CI/CD, CODEOWNERS, dev env | AI data + Core_Ai skeleton | AI data + AI_Kit skeleton |
| 2–6 | P1 | 2FA, RBAC, audit, idempotency, outbox | iOS S1, 01, S2, 02 | S2, QR, fonts | platform API, tenants | plate v0, CameraX | liveness v0, AVFoundation |
| 6–9 | P2 | customers + vehicles API | iOS workers (W1–W3, W5–W7) | Android W1–W7 (no W4), S3, S4 | workers + branches API | W4 Android, geofence lib | W4 iOS, registry tables |
| 9–12 | P3 | plates API, VEH history | iOS 20, 21, 22, S12 | Android 19–22, S12 | catalog, tax, roles UI API | plate v1 | Core ML conversions |
| 12–16 | P4 | orders API | iOS 08–12 | Android 08–12 | settings, notifications | scan screen 07 (Android) | scan screen 07 (iOS) |
| 16–19 | P5 | checkout hooks | receipts + payments API, iOS 13–15 | Android 13–15, S6 | WhatsApp, receipts PDF jobs | — | inference service v1 |
| 19–23 | P6 | attendance API | iOS 17 | Android 17 | location retention jobs | check-in Android 03–06 | check-in iOS 03–06 |
| 23–26 | P7 | performance API support | iOS 16, 18, 23, 24, S11 | Android 16, 18, 23, 24, S11 | accounting + reports API | — | — |
| 26–28 | P8 | offline sync API | iOS 25, 26, S5, S7, S10 | Android 25, 26, S5, S7, S10 | Excel, audit export, push | — | — |
| 28–31 | P9 | — | iOS S8 | Android S8 | — | fine-tune pipeline | registry promote / rollback |
| 31–37 | P10–P11 | pen-test fixes | App Store | Play Store | prod, runbooks | bias + attack tests | attack tests |

---

## 6. How six people work at the same time without blocking

### 6.1 Contract first
- Before coding an endpoint, its owner adds it to `Api_Contract/Open_Api.yaml` in a small PR (schemas + examples + error codes). One reviewer from Android, one from iOS.
- Apps build against the **Prism mock** (2.5) the same day. The real endpoint only has to match the contract.
- Never change a merged field's meaning; add new fields instead (apps in stores lag for weeks).

### 6.2 Git rules
- Trunk-based: branch from `main` → `feature/<your_name>/<short_feature>` (for example `feature/fares/receipt_pdf`) → PR → squash merge. Max ~400 changed lines per PR, open at most 2 days.
- `main` is protected: CI green + 1 review (from the other team) required. No direct pushes.
- Commit message: `Area: what changed` (for example `Orders: add item finish endpoint`).

### 6.3 No shared files
- Each backend module lives in `Backend/src/Modules/<Module>/` and is imported once in `App_Module.ts` (one-line conflicts only).
- Android: one Gradle module per feature (`Feature_<Name>`); iOS: one SPM package or folder per feature.
- Strings: each feature keeps its own strings file (`<Feature>_Strings.kt` / `Localizable` per package) so translators and devs do not collide.

### 6.4 Database migrations without collisions
- New migrations are named **`YYYYMMDDHHMM_<Module>_<What>.sql`** (for example `202612011030_Orders_Tables.sql`). They sort after `0001–0004` and two people never pick the same name.
- A migration is never edited after merge — write a new one.
- Every tenant table: `tenant_id`, `UNIQUE (tenant_id, id)`, composite FKs, `SELECT app.enable_tenant_rls('app.<table>')`. `npm run Db_Rls_Check` must stay green.
- Use the expand/contract pattern: add column → deploy code that writes both → backfill → remove old column in a later release.

### 6.5 Mocks so nobody waits
| You need | Before it exists, use |
|---|---|
| a backend endpoint | Prism mock from the contract |
| plate recognition | `Fake_Plate_Reader` returning a fixed plate after 600 ms (manual entry always available) |
| face + liveness | `Fake_Face_Engine` (debug builds only, never in release) |
| WhatsApp | backend `Messaging_Provider` "console" implementation that logs the message |
| payment gateway | cash only, card recorded with a typed terminal reference |

### 6.6 Definition of Done (every feature)
1. Works end-to-end on **Android and iOS** against the real backend (or the feature card stays open).
2. Contract updated; cross-tenant test added for each new endpoint (tenant B token → 404 / empty).
3. EN + AR with RTL checked; dark sunlight contrast; 44 pt targets.
4. No personal data in logs; secrets only in env / Keychain / Keystore.
5. Unit tests: backend domain ≥ 70 %, app view-models ≥ 60 %.
6. Reviewed by one person from the other team; CI green.

### 6.7 Security checklist used in every review
- Tenant from JWT only; no `tenant_id` accepted from client input; all queries through `Db_Client.withTenant/inCurrentTenant`.
- Permission checked on the server with `@Requires('<permission>')` for every route (hiding a button is not security).
- Input validated with zod (types, lengths, enums, ranges); unknown fields rejected.
- Return 404 (not 403) for ids of other tenants; ids are UUIDv7.
- Money in `numeric(12,2)`, never float; totals computed on the server.
- Create / pay / send endpoints require `Idempotency-Key`.
- Files: only through signed URLs (5 min), path `tenants/{tenant_id}/...`, content type + size checked.
- Audit log entry for every create / update / delete.
- Apps: no secrets in code, tokens in Keystore/Keychain, `FLAG_SECURE` / app-switcher blur on sensitive screens, certificate pinning in release.

---

## 7. AI models: deploy as an API or run inside the backend?

**Decision: hybrid — on-device models in the apps + one separate internal AI Inference Service (Python FastAPI + ONNX Runtime) that only the backend calls.** Do NOT run the models inside the NestJS process, and do NOT send faces to a third-party AI API.

| Option | Verdict | Why |
|---|---|---|
| Models inside NestJS (`onnxruntime-node`) | ✗ | inference is CPU-heavy and blocks the Node event loop → every station's API slows down (noisy neighbour, NFR SCL-04); pre-processing must match the Python training code exactly; one model crash takes the whole API down; cannot scale AI separately from the API |
| Third-party hosted AI API (e.g. a public inference cloud) | ✗ | worker faces are **biometric sensitive data** under Egypt's PDPL 151/2020; tenant isolation and data residency cannot be guaranteed; cost per call |
| **Separate internal Inference Service, called only by the backend** | ✓ | same Python code as training (no drift); scales on its own (CPU now, GPU later); private network only; the backend stays the single gate that checks the JWT tenant, permissions, quotas and audit before any AI call; per-tenant model routing in one place |
| On-device (LiteRT / Core ML) | ✓ (first pass) | plate in < 1.5 s and instant face/liveness feedback, works with weak 4G; but the server **re-checks** face + liveness for check-in (device result alone is never trusted) |

Flow: App → `POST /v1/plates/recognize` (backend: JWT, permission, quota, audit) → internal `POST http://inference:8000/plate/recognize` with `{tenantId, modelVersion}` → result → backend stores `plate_scans`. The inference service is not reachable from the internet. Details in `07_AI_Models_Work_Plan.pdf`.
