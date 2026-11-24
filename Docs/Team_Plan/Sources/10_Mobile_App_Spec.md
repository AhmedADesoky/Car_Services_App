<div class="cover" markdown="1">
# Mobile App (Android + iOS) — Specification & Implementation
<div class="meta">Platform 3 of 3 · Station owners, branch managers, workers and accountants · Android (Kotlin, Compose) by Ahmed Mongi + Abdelrahman · iOS (SwiftUI) by Fares + Omar · Station API (NestJS) by Ahmed A. / Fares / Mostafa / Omar<br>Status on 24 Nov 2026: Android Bind → Sign in (EN/AR) → Home working against the real backend; owners can now be created through the Admin Console.</div>
<span class="badge">THIRD · IN PROGRESS</span>
</div>

## 1. Who uses the app and how they get in
| Person | How the account is created | First sign-in |
|---|---|---|
| **Owner** | Company creates the station in the Admin Console → one-time activation link → owner chooses the password on the website | bind phone with the station code → sign in → **set up 2FA (mandatory)** |
| Branch manager / accountant | Owner adds them in the app (W2) with the role | temporary password → forced change → 2FA for accountant |
| Worker | Owner / manager adds them (W2) | temporary password → forced change → face enrollment (W4) before first check-in |

One app per platform, role-based navigation: the server decides what each role may do; the app only hides what the user cannot use.

## 2. Functional requirements (spec section 6 + 7) — status and owner
Legend: [DONE] [PARTIAL] [TODO]. "API" = backend owner, "Android" / "iOS" = screen owners.

| ID | Requirement | Status | API | Android | iOS |
|---|---|---|---|---|---|
| AUTH-01 | Bind phone to station (code / QR) | [PARTIAL] code done, QR todo | Ahmed A. | Mongi | Fares |
| AUTH-02 | Login station + username + password | [DONE] | Ahmed A. | Mongi | Fares |
| AUTH-03 | Password policy, forced change on first login | [TODO] | Ahmed A. | Mongi | Fares |
| AUTH-04 | Lockout 5 / 15 min, owner unlock | [PARTIAL] unlock todo | Ahmed A. | Mongi | Fares |
| AUTH-05 | 2FA for owner + accountant | [TODO] | Ahmed A. | Mongi | Fares |
| AUTH-06 | Biometric quick unlock | [TODO] | — | Mongi | Fares |
| AUTH-07 | Tokens, refresh rotation, logout, remote sign-out | [PARTIAL] logout todo | Ahmed A. | Mongi | Fares |
| AUTH-08 | Forgot password (owner OTP / worker via owner) | [TODO] | Ahmed A. | Mongi | Fares |
| BR-01..04 | Branches, geofence editor, overrides, worker branches | [TODO] | Mostafa | Mongi | Fares |
| W1–W7 | Worker lifecycle (list, add/edit, profile, face, security, deactivate, my profile) | [TODO] | Mostafa (+Omar face) | Mongi (+Abdelrahman W4) | Fares (+Omar W4) |
| ATT-01..11 | Face + location check-in/out, pings, board, corrections, manual fallback | [TODO] | Ahmed A. | Abdelrahman (03–06), Mongi (17) | Omar (03–06), Fares (17) |
| VEH-01..10 | Plate scan, Kuwaiti format (code + number), fallback, corrections, history, transfer | [TODO] | Mostafa (plates, vehicles) | Abdelrahman (07), Mongi (08–10) | Omar (07), Fares (08–10) |
| CUS-01..06 | Customers: profile, search, merge, consent, anonymise | [TODO] | Mostafa | Mongi | Fares |
| ORD-01..10 | Orders, items, assignees, status flow, timers, offline | [TODO] | Ahmed A. | Mongi | Fares |
| CAT-01..05 | Services, price history, tax versions, branch prices | [TODO] | Mostafa | Mongi | Fares |
| CHK-01..07 | Checkout, gap-free receipts, PDF, WhatsApp, delivery status | [TODO] | Fares (+Mostafa WhatsApp) | Mongi | Fares |
| PAY-01..06 | Cash / card / split, refunds, cash drawer | [TODO] | Fares | Mongi | Fares |
| ACC-01..05 | Journal entries, confirm, reports, period lock, export | [TODO] | Mostafa | Mongi | Fares |
| REP-01..04 | Owner / employee / finance dashboards | [TODO] | Mostafa | Mongi | Fares |
| XLS-01..05 | Excel templates, import with preview + undo, export | [TODO] | Mostafa | Mongi | Fares |
| SYS-01..04 | Push, audit log, settings, AR/EN RTL | [PARTIAL] AR/EN done on 3 screens | Ahmed A. / Mostafa | Mongi | Fares |
| AI-01..06 | Per-station model versions, packages, fine-tune, AI page | [TODO] | Omar | Abdelrahman / Mongi (S8) | Omar / Fares (S8) |
| S9 | Owner grants time-limited support access to the company | [TODO] | Ahmed A. | Mongi | Fares |

## 3. Non-functional requirements (spec section 8)
| ID | Target | Status / how |
|---|---|---|
| SEC-01/02 | Zero cross-station access; RLS on 100 % of station tables | [PARTIAL] RLS + `Db_Rls_Check` + isolation tests; extend per endpoint |
| SEC-03 | TLS 1.2+, HSTS, **certificate pinning** in release apps | [PARTIAL] pinning todo (Mongi, Fares) |
| SEC-04 | Per-station encryption key for phones, national IDs, faces, GPS, payment refs | [TODO] `Crypto_Service` (Ahmed A.) |
| SEC-05 | Argon2id 64 MB / t=3 | [DONE] |
| SEC-06 | OWASP ASVS L2 (API), MASVS L2 (apps) | [PARTIAL] checklist in each PDF |
| SEC-09 | Play Integrity / App Attest on login + check-in; rooted devices blocked for check-in | [TODO] Abdelrahman / Omar / Ahmed A. |
| SEC-10 | 100 % of changes audited, hash chain | [TODO] station audit (company side done) |
| PRV-01..05 | Faces as templates only + consent; GPS only during shift (90 days raw); Kuwait CITRA data privacy regulation; DSR in 30 days | [TODO] |
| PERF-01 | API p95 < 300 ms | [TODO] k6 |
| PERF-02 | Plate < 1.5 s on mid-range phone | [TODO] AI track |
| PERF-03 | Check-in < 4 s on 4G | [TODO] |
| PERF-06 | Cold start < 2 s, 60 fps | [TODO] baseline profiles / Instruments |
| REL-03 | No duplicate orders / payments / receipts | [PARTIAL] Idempotency-Key sent; server store todo |
| REL-06 | Orders work 8 h offline and sync without conflicts | [TODO] Room / SwiftData outbox |
| UX-01..05 | AR/EN anytime, < 30 s returning-car order, WCAG AA, gloves & sunlight, same tokens | [PARTIAL] |
| CMP-01/02 | Android 8.0+ / iOS 17+ | [DONE] Android · [TODO] iOS |
| MNT-01 | 70 % backend domain / 60 % view-model coverage, linters clean | [TODO] |
| OBS-01/02 | Tenant-tagged telemetry, crash-free ≥ 99.5 % | [TODO] |

## 4. Station database schema (all station tables)
Every table: `id uuid PK default uuidv7()`, `tenant_id uuid NOT NULL`, `created_at`, `updated_at`, `created_by`, `version int`, `UNIQUE (tenant_id, id)`, composite FKs `(tenant_id, x_id)`, `SELECT app.enable_tenant_rls('app.<table>')`, indexes start with `tenant_id`. **ENC** = encrypted with the station key (`Crypto_Service`), stored as `bytea`.

### 4.1 Identity (built: migrations 0002, 0004)
| Table | Key columns |
|---|---|
| `users` | username citext UNIQUE per station, display_name, password_hash, status (invited/active/suspended/deactivated/anonymized), must_change_password, mfa_type, mfa_secret ENC, phone_e164 ENC, phone_hash, email, locale, perm_version, last_login_at |
| `roles`, `role_permissions`, `user_roles` | system roles owner / branch_manager / worker / accountant + custom roles; scope own/branch/all |
| `devices` | user_id, platform, model, os/app version, attestation_status, bound_at, revoked_at |
| `refresh_tokens` | user_id, device_id, family_id, token_hash, expires_at, rotated_at, revoked_at |
| `login_attempts` | username, device_id, ip, success, reason, at |
| `owner_invitations` | user_id, token_hash, expires_at, used_at, revoked_at (built with the Admin Console) |
| `password_history` *(P1)* | user_id, password_hash, created_at (last 3) |
| `idempotency_keys` *(P1)* | key, user_id, endpoint, request_hash, state, response_status, response_body, expires_at |
| `audit_logs`, `audit_chain_heads` *(P1)* | seq, actor, action, entity, before/after jsonb, ip, device, prev_hash, hash |
| `outbox_events` *(P1)* | type, payload jsonb (ids only), published_at, attempts, last_error |
| `tenant_keys` *(platform, P1)* | version, wrapped_dek, kek_ref |

### 4.2 Organisation & workers (Mostafa, P2)
| Table | Key columns |
|---|---|
| `branches` | name, address, phone, geo_center_lat/lng numeric(9,6), geofence_radius_m 30–1000, geofence_polygon jsonb, opening_hours jsonb, receipt_prefix, is_active |
| `worker_profiles` | user_id, employee_code UNIQUE, full_name_ar/en, photo_uri, national_id ENC, birth_date, gender, nationality, mobile ENC + hash, whatsapp ENC, emergency_contact ENC, job_title, skills text[], employment_type, hire/end date, primary_branch_id, assigned_hours_per_day, pay_base / pay_hourly / commission_pct, status, deactivation_reason, anonymized_at |
| `worker_branches` | (worker_id, branch_id) PK, is_primary |
| `worker_schedules` | worker_id, weekday 0–6, start_time, end_time, valid_from/to |
| `worker_documents` | worker_id, kind, file_uri, file_sha256, expires_on |
| `face_templates` *(Omar)* | worker_id, embedding ENC (512 × float32), model_version, quality_score, enrolled_by, consent_id, revoked_at |

### 4.3 Attendance (Ahmed A., P6)
| Table | Key columns |
|---|---|
| `attendance_challenges` | user_id, device_id, nonce_hash, type, prompts jsonb, expires_at (60 s), used_at |
| `attendance_attempts` | worker_id, device_id, type, lat/lng ENC, accuracy_m, mock_location, integrity_ok, inside_geofence, distance_m, face_score, liveness_score, model versions, result, reject_reason |
| `attendance_records` | worker_id, branch_id, work_date, check_in_at, check_out_at, attempt ids, minutes_on_site/outside, late/early minutes, status (open/closed/auto_closed) — time columns not updatable |
| `location_pings` | record_id, at, lat/lng ENC, accuracy, inside (raw 90 days) |
| `presence_intervals` | record_id, started_at, ended_at, inside |
| `attendance_corrections` | record_id, field, old_value, new_value, reason, corrected_by |

### 4.4 Customers, vehicles, plates (Mostafa, P2–P4)
| Table | Key columns |
|---|---|
| `customers` | name, name_normalized (trigram index), phone_e164 ENC, phone_hash UNIQUE, phone_last4_hash, preferred_locale, whatsapp_opt_in, opt_in_at, notes, merged_into_id, anonymized_at |
| `vehicles` | plate_display, plate_normalized UNIQUE, plate_country, plate_type, make, model, year, color, body_type (sedan/suv/hatchback/pickup/van), vin, current_customer_id, last_mileage |
| `vehicle_ownerships` | vehicle_id, customer_id, from_date, to_date |
| `plate_scans` | device_id, user_id, branch_id, image_uri, predicted_text, confidence, model_version, ran_on (device/server), final_text, was_corrected, vehicle_id, order_id |

### 4.5 Catalog (Mostafa, P3)
| Table | Key columns |
|---|---|
| `service_categories` | name_ar, name_en, sort_order |
| `services` | category_id, name_ar, name_en, description, photo_uri, est_minutes, tax_category (standard/exempt), is_active, retired_at |
| `service_prices` | service_id, branch_id NULL, price numeric(12,2), currency, effective_from, effective_to, set_by — EXCLUDE overlapping ranges |
| `tax_rates` | name, rate numeric(5,2), tax_category, effective_from/to, set_by |

### 4.6 Orders (Ahmed A., P4)
| Table | Key columns |
|---|---|
| `orders` | order_no UNIQUE, branch_id, customer_id, vehicle_id, plate_scan_id, entered_at, checkout_at, paid_at, problem_reported, diagnosis, mileage, status (in_progress/ready_for_checkout/awaiting_payment/paid/cancelled/refunded), subtotal, discount_total, tax_total, grand_total, frozen totals jsonb, cancel_reason, client_ref UNIQUE — partial UNIQUE one open order per vehicle |
| `order_items` | order_id, service_id, name_snapshot, unit_price_snapshot, tax_rate_snapshot, qty, discount, line_total, status (pending/in_progress/done/removed), fix_performed, vehicle_part, outcome (repaired/replaced/attention), finished_at, removed_reason |
| `order_item_assignees` | (item_id, worker_id) PK, minutes_spent, finished_by |
| `order_status_history` | order_id, from_status, to_status, by_user, at, reason |
| `order_attachments` | order_id, kind (photo/voice), file_uri, sha256 |
| `order_counters` | (branch_id, year) PK, last_value |

### 4.7 Money & accounting (Fares + Mostafa, P5–P7)
| Table | Key columns |
|---|---|
| `receipt_counters` | (branch_id, year) PK, last_value — incremented with `FOR UPDATE` in the payment transaction → gap-free |
| `receipts` | order_id UNIQUE, receipt_no UNIQUE, issued_at, locale, pdf_uri, image_uri, totals jsonb, e_receipt_uuid |
| `payments` | order_id, branch_id, method (cash/card/wallet/other), amount ≠ 0, currency, received_by, received_at, business_date, terminal_ref ENC, status, refund_of, reason, idempotency_key UNIQUE — amount/method not updatable |
| `cash_closures` | branch_id, business_date UNIQUE per branch, expected_cash, counted_cash, difference, note, closed_by |
| `ledger_accounts`, `journal_entries`, `journal_lines`, `financial_corrections` | balanced entries (deferred check Σdebit = Σcredit), UNIQUE(source_type, source_id), period lock |

### 4.8 Messaging, data, AI, system
| Table | Key columns | Owner |
|---|---|---|
| `message_templates`, `message_deliveries` | channel, locale, template, receipt_id, to_hash, provider_msg_id, status, attempts, idempotency_key UNIQUE | Mostafa |
| `notifications`, `push_tokens` | user_id, type, payload, read_at / device_id, token ENC, platform | Mostafa |
| `import_jobs`, `import_rows`, `export_jobs` | kind, file_uri, status, counts, undo_until / row data + errors / filters, expires_at | Mostafa |
| `tenant_ai_models`, `ai_training_jobs`, `ai_training_samples`, `ai_inference_logs` | versions, package key ENC, thresholds, metrics, consent_scope, no images in logs | Omar |
| `tenant_settings`, `integrations`, `support_access_grants` | key/value jsonb; secrets ENC write-only; time-boxed grants | Mostafa / Ahmed A. |

## 5. Screen inventory (both apps)
| # | Screen | Role | Phase | Android | iOS |
|---|---|---|---|---|---|
| S1 | Station code / QR binding | all | P1 | Mongi | Fares |
| 01 | Sign in (+ 2FA step) | all | P1 | Mongi ✓ | Fares |
| S2 | Change password / 2FA setup | all | P1 | Mongi | Fares |
| 02 | Worker home | worker | P1 | Mongi (shell ✓) | Fares |
| S3, S4 | Owner setup wizard; branches + geofence map | owner | P2 | Mongi | Fares |
| W1–W3, W5–W7 | workers list, add/edit, profile, security, deactivate, my profile | owner/manager/worker | P2 | Mongi | Fares |
| W4 | Face enrollment | owner/manager | P2 | Abdelrahman | Omar |
| 19, 20, 21, S12 | worker account+location, services & prices, tax & permissions, custom roles | owner | P2–P3 | Mongi | Fares |
| 22 | Customer profile + 2D car service map | owner/worker | P3 | Mongi | Fares |
| 07 | Scan plate | worker | P4 | Abdelrahman | Omar |
| 08–12 | new car, returning car, history, problem + repairs, order in progress | worker | P4 | Mongi | Fares |
| 13–15, S6 | checkout, WhatsApp + payment, paid; settings | worker/owner | P5 | Mongi | Fares |
| 03–06 | check-in, confirmed, refused, check-out summary | worker | P6 | Abdelrahman | Omar |
| 16, 17, 18, 23, 24, S11 | dashboards, attendance board, performance, finance, payments, cash drawer | owner/accountant | P6–P7 | Mongi | Fares |
| 25, 26, S5, S7, S10 | Excel, activity log, notifications, plan & usage, offline status | owner/accountant | P8 | Mongi | Fares |
| S8, S9 | AI page; support access grant | owner | P9–P10 | Mongi | Fares |

Rule for every screen: no server / database / debug information is shown to users, in any build.

## 6. App ↔ backend contract rules
1. Base URL per build (`10.0.2.2:3000` emulator, LAN IP on a phone, HTTPS in release); certificate pinning in release.
2. Every request: `Authorization`, `Accept-Language`, `X-App-Version`; every POST that creates or pays: `Idempotency-Key` (reused on retry).
3. Errors are RFC 9457 `problem+json` with a stable `code`; each app maps codes to Arabic/English text in one table.
4. Times are UTC from the server; timers use server time (`Date` header offset), never the phone clock.
5. 401 `TOKEN_STALE`/`TOKEN_INVALID` → one shared refresh, then retry once; 403 `STATION_SUSPENDED` → blocking screen with the company contact.

## 7. Next 6 weeks for the mobile track
| Week | Android (Mongi) | iOS (Fares) | API |
|---|---|---|---|
| 1–2 | S2 + 2FA + QR on S1 | project + design system + S1/01 | Ahmed A.: password change, restricted token, 2FA |
| 3–4 | Hilt + Room/SQLCipher + outbox | S2, 02, Keychain, pinning | Ahmed A.: RBAC guard, audit, idempotency |
| 5–6 | S3, S4, W1, W2 | S3, S4, W1, W2 | Mostafa: branches + workers API (owner can add workers) |
After week 6 an owner activated through the Admin Console can set up branches and add workers who sign in — **the first fully real chain on phones**.
