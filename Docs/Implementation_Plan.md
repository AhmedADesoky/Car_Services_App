# Implementation_Plan — Car Services SaaS

Based on *Vehicle Service SaaS – Technical Specification & Implementation Plan v1.0* (20 Nov 2026)
and the Android / iOS design canvases (10 screens each).

## 1. Architecture in one picture
```
Android (Kotlin, Compose)  ─┐
iOS (SwiftUI)              ─┼─ HTTPS /v1 + JWT(tid) ─► Core API (NestJS, modular monolith)
                            │                           ├─ Tenant_Context_Guard → AsyncLocalStorage
                            │                           ├─ Db_Client.withTenant → SET LOCAL app.tenant_id
                            │                           └─ AI Inference Service (FastAPI + ONNX)
                            ▼
            Supabase: PostgreSQL 16 (schema "app", RLS FORCE on every tenant table, pgvector)
                      Storage (tenants/{tenant_id}/...), later Redis + RabbitMQ
```
The apps never call Supabase directly. The tenant comes **only** from our JWT `tid` claim.

## 2. Repository layout (monorepo)
| Folder | Contents | Owner |
|---|---|---|
| `Backend/` | NestJS API, SQL migrations, seed, isolation tests | Ahmed Abdelsamad + Mostafa Tayar |
| `Android_App/` | Android Studio multi-module project | Ahmed Mongi (lead) |
| `iOS_App/` | SwiftUI app + SPM packages | Fares Wael (lead) |
| `AI_Models/` | notebooks, `Common_Utils`, inference service | Abdelrahman Hisham, Omar Mohamed |
| `Api_Contract/Open_Api.yaml` | single API contract for both apps | module owners |
| `Design_Tokens/Design_Tokens.json` | colours, type, shapes from the canvases | both leads |
| `Docs/` | this plan, `AI_Models_Plan.md`, `Setup_Guide.md` | all |

## 3. Phases (two-week sprints, ~37 weeks)
| Phase | Weeks | Backend | Android / iOS screens | AI |
|---|---|---|---|---|
| **P0 Foundations** ✅ started | 0–2 | NestJS skeleton, Supabase, migrations 0001–0003, CI | shells, design system, Bind → Login → Home | env, data plan, synthetic plates |
| **P1 Tenancy & identity** | 2–6 | tenants/plans, Argon2id, lockout, refresh rotation ✅, 2FA, audit hash chain, idempotency table, outbox, cross-tenant tests | S1, 01, S2, 02 | detector v0, face baseline, passive liveness v0 |
| **P2 Workers & branches** | 6–9 | branches + geofence, worker_profiles, schedules, documents, face_templates | S3, S4, W1–W7, 19, 21 | — |
| **P3 Catalog, customers, vehicles** | 9–12 | services, price history, tax, customers (enc phone + HMAC), vehicles | 20, 22, S12 | plate v1 ≥ 90 % |
| **P4 Plate AI & orders** | 12–16 | plate_scans, orders, items, assignees, timer | 07–12 | LiteRT / Core ML plate packages |
| **P5 Checkout & payments** | 16–19 | receipts (gap-free counters), payments, WhatsApp per station | 13–15, S6 | — |
| **P6 Attendance** | 19–23 | challenge nonce, check-in sequence (spec 10.2), pings, corrections | 03–06, 17 | face + liveness v1 on device and server |
| **P7 Accounting & dashboards** | 23–26 | ledger, journal, cash closures, reports | 16, 18, 23, 24, S11 | — |
| **P8 Excel, audit, offline** | 26–28 | import / export jobs, notifications | 25, 26, S5, S7, S10 | — |
| **P9 Per-station AI** | 28–31 | tenant_ai_models, training jobs, registry | S8 | fine-tune pipeline, promotion / rollback |
| **P10 Hardening & pilot** | 31–35 | pen-test, cert pinning, load tests | S9 | attack testing |
| **P11 Launch** | 35–37 | production, runbooks | store releases | monitoring |

## 4. What exists after the P0 setup
**Backend**
* `GET /v1/health`, `POST /v1/devices/bind`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, `GET /v1/auth/me`.
* RFC 9457 errors, zod validation, Argon2id, a 5-attempt / 15-minute lockout, and refresh-token rotation with reuse detection.
* Migrations: schema `app`, `uuidv7()`, `enable_tenant_rls()`, platform tables, identity tables, role `app_rw`.
* `Db_Rls_Check` (CI gate) and `Cross_Tenant_Isolation.spec.ts`.

**Android**
* Modules: App, Core_Designsystem, Core_Network, Core_Security, Feature_Auth, Feature_Home.
* Bind (S1) → Sign in (01, EN / عربي + RTL) → Home (02, greeting with the user and station name, check-in card placeholder).
* Keystore-encrypted tokens, automatic token refresh, Idempotency-Key on every POST.

**AI**
* 21 notebooks with model code, training loops, evaluation and export, plus `Common_Utils`.

## 5. Next tasks (Sprint 1 of P1)
1. Fill in `Backend/.env`, run `Db_Migrate`, `Db_Seed` and `test:isolation` (everyone).
2. Backend: `idempotency_keys`, `audit_logs` (hash chain), `outbox_events` migrations + interceptor.
3. Backend: password change + forced change on first login, TOTP 2FA for owner / accountant.
4. Android: QR scan on Bind (CameraX + ML Kit barcode), change-password screen (S2), Roboto Flex + Noto Kufi fonts in `res/font`.
5. Android: `Core_Database` (Room + SQLCipher, one DB file per tenant, wiped on unbind).
6. CI: GitHub Actions `Backend_Ci.yml`, `Android_Ci.yml` green on every PR.
7. AI: start the Kuwaiti pilot capture (with consent), run the Kuwaiti synthetic generator (100 k), train detector v0.

## 6. Definition of Done (every feature)
Works end-to-end on Android **and** iOS against the real backend · cross-tenant test added and passing ·
RLS check green · EN + AR (RTL) · no personal data in logs · reviewed by one person from the other team.
