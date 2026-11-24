<div class="cover" markdown="1">
# Admin Console — Specification & Implementation
<div class="meta">Platform 1 of 3 · Company staff website (<code>Web_Admin/</code>) + Admin API (<code>Backend/src/Platform/</code>) · Owner: Ahmed Abdelsamad<br>Status: <b>built and verified end-to-end</b> on 24 Nov 2026 (sign-in with forced password change + 2FA, requests, station creation, owner invitation, company RBAC, audit chain).</div>
<span class="badge">FIRST · BUILT</span>
</div>

## 1. Purpose
The Admin Console is the company's control room. Staff review requests from the public website, **create stations**, invite their owners, manage plans and the company's own team and roles, and watch platform health. It shows **totals only**: a station's customers, cars, orders, money, worker profiles, faces and locations are never visible here (spec 3.7). Support can only look inside a station if its owner grants time-limited access.

### Why it is built first
Every other flow starts with a station. Without the console you need the seed script; with it, the whole real chain works: **Super Admin → station → owner activation → owner adds workers**.

## 2. Architecture
```
Staff browser ──HTTPS──► Web_Admin (Next.js 15, port 3003)
                           │  httpOnly SameSite=Strict cookies hold the tokens (JS never sees them)
                           │  /api/auth/*  and  /api/platform/* (same-origin proxy, CSRF origin check)
                           ▼  server-to-server, private network
                         Admin API (NestJS, separate process, port 3001, 127.0.0.1 by default)
                           │  IP allowlist · Helmet · throttling · default-deny guard · platform JWT
                           ▼  role platform_rw (NOBYPASSRLS)
                         Supabase Postgres  (company tables + INSERT-only provisioning into a station)
```
| Decision | Reason |
|---|---|
| Separate process + port + DB role (`platform_rw`) | an attack on the admin side cannot reach station business data; the station API role `app_rw` cannot read company tables (checked by `Db_Rls_Check`) |
| Separate JWT secret + audience `platform` | a station token can never call the Admin API and vice versa (tested) |
| Backend-for-frontend (Next.js server holds tokens) | no token in `localStorage`, no XSS token theft; Admin API is never exposed to the browser (no CORS) |
| IP allowlist (`PLATFORM_ALLOWED_IPS`) | production refuses to start without it (or `PLATFORM_ALLOW_ANY_IP=true` behind a VPN) |
| Default-deny guard | a route without `@Platform_Requires(...)` / `@Platform_Any_User()` is refused |

## 3. Company RBAC (departments, roles, permissions)
### Permissions (catalogue, read-only)
| Code | Category | Meaning |
|---|---|---|
| `dashboard.view` | Health | company dashboard (totals only) |
| `requests.view` / `requests.review` | Requests | see / approve-reject public requests |
| `stations.view` / `stations.create` / `stations.update` / `stations.suspend` / `stations.delete` | Stations | list, create + invite owner, edit + change plan, suspend / reactivate, schedule deletion |
| `plans.manage`, `billing.view` | Billing | edit plans & limits, billing status |
| `team.view`, `team.manage`, `roles.manage` | Team | staff accounts, roles & permissions |
| `audit.view` | Security | company audit log + chain verification |
| `health.view` | Health | platform health |
| `support.access` | Security | use owner-granted support access |

### Default roles (system, cannot be deleted)
| Role | Department | Permissions |
|---|---|---|
| Super Admin | Management | all (cannot be reduced) |
| Sales | Sales | dashboard, requests view/review, stations view/create |
| Support | Support | dashboard, stations view, health, support.access |
| Finance | Finance | dashboard, stations view/update, plans.manage, billing.view |
| Engineering | Engineering | dashboard, stations view, health, audit |

### RBAC rules (enforced on the server)
1. Every route declares its permissions; the guard checks them on every request using the **current** DB state.
2. `perm_version` on the user: changing roles, role permissions, password, suspension or 2FA bumps it → every old token dies immediately.
3. **No privilege escalation**: you can only grant roles/permissions you already hold (`CANNOT_GRANT`).
4. At least one active Super Admin with 2FA must remain (`LAST_SUPER_ADMIN`); you cannot suspend yourself or change your own roles.
5. Custom roles can be created (e.g. "Account Manager"); system roles cannot be deleted; a role with members cannot be deleted.

## 4. Database schema (migration `202611241000_Platform_Admin.sql`, fix `202611241200_Platform_Counts_Fix.sql`)
| Table | Columns (key ones) | Notes |
|---|---|---|
| `platform_departments` | id, name UNIQUE, description, created_at | seeded: Management, Sales, Support, Finance, Engineering |
| `platform_permissions` | code PK, category, description | catalogue, read-only for the API |
| `platform_roles` | id, name UNIQUE, description, is_system | seeded 5 roles |
| `platform_role_permissions` | (role_id, permission_code) PK | |
| `platform_users` | id, email citext UNIQUE, full_name, password_hash (Argon2id), status (invited/active/suspended/deactivated), department_id, must_change_password, mfa_secret bytea (AES-256-GCM), mfa_enabled, mfa_last_step, perm_version, last_login_at, created_by | |
| `platform_user_roles` | (user_id, role_id) PK | |
| `platform_refresh_tokens` | id, user_id, family_id, token_hash UNIQUE, expires_at, rotated_at, revoked_at, ip, user_agent | rotation + reuse detection |
| `platform_login_attempts` | id, email, success, reason, ip, at | lockout 5 / 15 min |
| `platform_audit_logs` | id, seq UNIQUE, actor_id, actor_email, action, target_type, target_id, tenant_id, details jsonb, ip, at, prev_hash, hash | INSERT/SELECT only; SHA-256 chain |
| `platform_audit_head` | id=1, last_seq, last_hash | serialises the chain (`FOR UPDATE`) |
| `station_requests` | id, status (new/in_review/approved/rejected/spam), plan_code, business_name, business_name_ar, contact_name, contact_phone, contact_email, city, branches_count, workers_count, message, locale, source_ip_hash, reviewed_by, reviewed_at, review_note, tenant_id | written by the public site (INSERT only) |
| `owner_invitations` *(station table, RLS)* | id, tenant_id, user_id, token_hash, expires_at, used_at, revoked_at, created_by_platform_user | single use, 48 h |
| `tenants` *(added)* | contact_name, contact_phone, contact_email, source_request_id | business contact for billing |
| function `platform_tenant_counts()` | SECURITY DEFINER, returns per-station active/invited users + devices | **filters by tenant_id explicitly** — on Supabase, definer functions bypass RLS (a bug found and fixed in testing) |

## 5. Admin API (all under `/platform/v1`)
| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | → `{next:'setup'}` (password change and/or 2FA setup required) or `{next:'mfa'}` |
| POST | `/auth/password/change` | setup or full | policy: ≥ 12 chars, 3 of 4 classes, not common, not containing the email name |
| POST | `/auth/mfa/setup` · `/auth/mfa/enable` | setup | TOTP (RFC 6238), QR via `otpauth://`; enable returns the session |
| POST | `/auth/mfa/verify` | mfa | ±1 step, replay protection (`mfa_last_step`) |
| POST | `/auth/refresh` · `/auth/logout` · GET `/auth/me` | public / any user | 15-min access, 12-h refresh rotation |
| GET | `/dashboard` | dashboard.view | stations by status/plan, requests by status, 6-month trend, user/device totals |
| GET/GET | `/station-requests`, `/station-requests/{id}` | requests.view | |
| POST | `/station-requests/{id}/in-review` · `/reject {note}` · `/spam` | requests.review | state machine new → in_review → rejected / spam; approved only by station creation |
| GET | `/stations?status&plan&q`, `/stations/{id}` | stations.view | usage totals; owner invitation state; **no business data**; KMS/DB route fields removed |
| POST | `/stations` | stations.create | one transaction: tenant + storage prefix + 4 system roles + permissions + owner (`invited`, unusable random password) + invitation + request approved + audit; then SMS |
| PATCH | `/stations/{id}` | stations.update | names, tax no., contact, plan |
| POST | `/stations/{id}/suspend` · `/reactivate` · `/schedule-deletion` `{reason}` | stations.suspend / stations.delete | allowed transitions only; suspension blocks every station token at once |
| POST | `/stations/{id}/resend-invitation` | stations.create | revokes unused links, issues a new one |
| GET / PATCH | `/plans`, `/plans/{code}` | stations.view / plans.manage | limits merged as JSON |
| GET/POST/PATCH | `/team`, `/team/{id}` | team.view / team.manage | temp password returned **once** |
| POST | `/team/{id}/suspend` · `/reactivate` · `/reset-password {resetMfa}` | team.manage | |
| GET / POST / PUT / DELETE | `/permissions`, `/departments`, `/roles`, `/roles/{id}/permissions` | team.view / roles.manage | |
| GET | `/audit-logs?before&action`, `/audit-logs/verify` | audit.view | |

Bootstrap: `npm run Platform_Create_Super_Admin -- --email you@company.com --name "Your Name"` (no API can create the first Super Admin).

## 6. Website screens (`Web_Admin/src/app`)
| Route | Screen | Motion / interaction |
|---|---|---|
| `/login` | split layout: animated "station network" (stations light up, pulses travel to the hub) + sign-in card | card springs in; steps slide (password → new password → QR → code); QR pops in |
| `/dashboard` | KPI cards, 6-month bars, plan mix, latest requests | counters count up when in view, bars grow staggered, cards lift on hover |
| `/requests`, `/requests/[id]` | tabs by status, request cards; detail + decision panel | sliding tab pill (`layoutId`), live pulse on "new" badge, staggered cards |
| `/stations`, `/stations/new`, `/stations/[id]` | table with filters; 3-step wizard (prefilled from a request); detail with owner state and actions | rows stagger in, progress segments fill, steps slide by direction, success modal with burst |
| `/plans` | plan cards with limits, edit price | hover lift |
| `/team` | staff cards, add staff, temporary password shown once | layout animation, modal spring |
| `/roles` | role list + permission matrix by category, departments | sliding role pill, check marks pop, "Save" appears only when changed |
| `/audit` | timeline, verify chain | entries slide in, verification banner |
All motion respects "reduce motion". Keyboard: Escape closes dialogs; all actions are buttons/links with labels; 44 px targets.

## 7. Functional requirements
| ID | Requirement | Status |
|---|---|---|
| ADM-01 | First Super Admin only via command line | [DONE] |
| ADM-02 | Staff sign-in: password → forced change on first use → mandatory TOTP 2FA | [DONE] |
| ADM-03 | Lockout after 5 failures in 15 min (password or code) | [DONE] |
| ADM-04 | Company departments, roles, permissions; custom roles; no escalation; last Super Admin protected | [DONE] |
| ADM-05 | Staff accounts: create (temp password once), edit roles/department, suspend, reactivate, reset password / 2FA | [DONE] |
| ADM-06 | Station requests inbox: list by status, detail, in review, reject with note, spam | [DONE] |
| ADM-07 | Create station from a request or manually, owner invited by one-time 48-h link | [DONE] (SMS provider pending) |
| ADM-08 | Station list with usage totals, detail with owner invitation state | [DONE] |
| ADM-09 | Change plan, suspend / reactivate, schedule deletion (30 days), resend invitation | [DONE] |
| ADM-10 | Plans & limits editing | [PARTIAL] price editing in UI; limits via API |
| ADM-11 | Hash-chained company audit log with verification | [DONE] |
| ADM-12 | Dashboard with totals only | [DONE] |
| ADM-13 | Support access grants (owner-granted, time-boxed, double audit) | [TODO] needs the station app screen S9 |
| ADM-14 | Billing: invoices, payment status, reminders, auto-suspend for non-payment | [TODO] |
| ADM-15 | Platform health page (error rates, latency, AI accuracy per station) | [TODO] after monitoring is deployed |
| ADM-16 | Tenant deletion job (crypto-shredding + certificate) and full station export | [TODO] needs Crypto_Service |

## 8. Non-functional requirements
| ID | Target | Status |
|---|---|---|
| ADM-SEC-01 | Admin API reachable only from allowlisted IPs / VPN; binds to 127.0.0.1 by default | [DONE] |
| ADM-SEC-02 | Tokens only in httpOnly SameSite=Strict cookies; CSRF origin check on all mutations | [DONE] |
| ADM-SEC-03 | Strict headers: CSP, X-Frame-Options DENY, no-referrer, noindex, HSTS in production | [DONE] |
| ADM-SEC-04 | Separate DB role, JWT secret + audience; app_rw has no access to platform tables (CI check) | [DONE] |
| ADM-SEC-05 | Every mutation audited in the same transaction | [DONE] |
| ADM-SEC-06 | 2FA secrets encrypted (AES-256-GCM, key from secret manager) | [DONE] |
| ADM-SEC-07 | Staff sessions ≤ 12 h; access tokens 15 min | [DONE] |
| ADM-PERF-01 | Dashboard < 2 s | [PARTIAL] ~4–5 s on the remote dev DB → cache `platform_tenant_counts` per minute or keep `tenant_usage` updated by events |
| ADM-PERF-02 | Station creation < 3 s | [PARTIAL] batched permission inserts (was ~12 s); re-measure |
| ADM-UX-01 | Works from 360 px phones (drawer menu) to desktop; reduced motion respected | [DONE] |
| ADM-SEC-08 | Single-flight token refresh in the website server (concurrent requests share one rotation, otherwise reuse detection revokes the session); dead sessions clear their cookies (no redirect loop) | [DONE] fixed 24 Nov; with several website instances use sticky sessions or a shared cache |
| ADM-SEC-09 | Client IP forwarded to the Admin API only from trusted proxies (`TRUSTED_PROXY_HOPS`) — never a header the visitor typed | [DONE] |
| ADM-OPS-01 | Separate deploy: `npm run start:platform:prod` and `Web_Admin` behind VPN | [TODO] deployment |

## 9. Run it
```powershell
cd C:\Car_Services_App\Backend
npm run Db_Migrate
npm run Platform_Create_Super_Admin -- --email you@company.com --name "Your Name"
npm run start:platform
```
```powershell
cd C:\Car_Services_App\Web_Admin
npm install
npm run dev
```
Open `http://localhost:3003` → sign in with the temporary password → choose a password → scan the QR with Google/Microsoft Authenticator → type the code.

> Development tip: never run `npm run build` in `Web_Admin` / `Web_Public` while `npm run dev` is running in the same folder — they share `.next` and the dev server breaks ("Cannot find module './611.js'"). Stop dev first, or delete `.next` and restart.

## 10. Tests
`Backend/Tests/Platform/Platform_Onboarding.spec.ts` (real DB): Super Admin setup flow · station token rejected by Admin API and admin token rejected by station API · public request → station → activation → owner login · duplicate approval refused · per-station counts (regression) · Support role cannot create stations / see team / audit · audit chain intact.
