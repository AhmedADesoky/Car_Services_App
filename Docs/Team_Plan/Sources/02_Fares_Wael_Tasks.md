<div class="cover" markdown="1">
# Fares Wael — iOS Lead + Money Backend
<div class="meta">iOS team lead · Owner of the iOS app architecture and every iOS screen except camera/AI/location screens · Owner of the money backend: checkout, receipts, payments, refunds, cash drawer.<br>Reviewer for: Ahmed Mongi (Android), Omar (iOS AI). Your reviewer: Ahmed Mongi (iOS), Ahmed Abdelsamad (backend).</div>
<span class="badge">CORE · MONEY + iOS</span>
</div>

## 0. Your two core responsibilities
1. **The iOS app** — the second of the two products the station owner pays for. Same features, same API and same design tokens as Android (feature parity is a Definition-of-Done rule).
2. **The money path** — checkout → receipt number → payment → refund → cash drawer. Spec rule REL-03: **zero duplicate payments, orders or receipts**, even with retries and bad networks. This is the code a station trusts with its cash.

### Deliverables
| # | Feature | Weeks | Depends on (use mocks until ready) |
|---|---|---|---|
| 1 | iOS project, SPM packages, design system, navigation by role | 0–3 | `Design_Tokens.json` |
| 2 | Networking: generated client, auth + refresh, idempotency, pinning | 1–4 | contract |
| 3 | Persistence per tenant + device binding + Keychain + unbind wipe | 2–4 | — |
| 4 | iOS screens S1, 01, S2, 02 | 2–6 | Ahmed A. auth API (exists) |
| 5 | iOS owner screens W1–W3, W5–W7, S3, S4 | 6–9 | Mostafa workers/branches API |
| 6 | iOS 19, 20, 21, 22 (2D car map), S12 | 9–12 | Mostafa customers/vehicles + catalog |
| 7 | iOS 08–12 (new car, returning car, history, pick repairs, order in progress) | 12–16 | Ahmed A. orders |
| 8 | **Backend: checkout, receipts, payments, refunds, cash closures** | 14–19 | Ahmed A. orders + idempotency |
| 9 | iOS 13, 14, 15 (checkout, WhatsApp + payment, paid) + S6 | 16–19 | #8 |
| 10 | iOS 17, 16, 18, 23, 24, S11 (boards, dashboards, finance, drawer) | 19–26 | Mostafa reports |
| 11 | iOS 25, 26, S5, S7, S10 (Excel, audit, notifications, plan, offline) | 26–28 | Mostafa |
| 12 | TestFlight → App Store, App Store privacy labels | 31–37 | — |

Omar builds on iOS: `AI_Kit`, `Location`, screens 07 (scan), 03–06 (check-in), W4 (face enrollment), S8 (AI page). You own the app shell they plug into — agree the `Plate_Reader` / `Face_Engine` protocols with him in week 1.

---

## 1. iOS project setup (week 0–1)

### Folder layout (`iOS_App/`)
```
iOS_App/
  Car_Services_App.xcodeproj
  App/                        Car_Services_App.swift (@main), App_Router.swift, App_Container.swift
  Packages/                   local Swift packages (each with Tests/)
    Design_System/            Car_Colors, Car_Typography, Car_Components, App_Strings (EN/AR)
    Networking/               generated client (swift-openapi-generator), Auth_Middleware, Idempotency_Middleware, Pinning_Delegate
    Persistence/              SwiftData models + Tenant_Store_Factory
    Security/                 Keychain_Store, Session_Store, App_Switcher_Shield
    Sync/                     Outbox_Uploader (BGTaskScheduler), Sync_Status
    AI_Kit/                   (Omar) Plate_Reader, Face_Engine, Liveness_Engine protocols + Core ML impl
    Location/                 (Omar) Location_Service, Geofence, mock detection
  Features/
    Auth/ Home/ Orders/ Customers/ Checkout/ Workers/ Branches/ Catalog/ Dashboard/ Finance/ Reports/ Data/ Audit/ Settings/
```
- iOS 17+ (CMP-02), Swift 5.10+/Swift 6 language mode, `@Observable` view models, `async/await`, no Combine for new code.
- Bundle id `com.carservices.app` (debug `.debug`), configurations `Debug` / `Release` with `BASE_URL` in `.xcconfig`:
  - Simulator: `http://localhost:3000/v1/` (Mac running the backend) — add `NSAppTransportSecurity` exception **only in the Debug Info.plist**.
  - Release: `https://api.<domain>/v1/`, ATS default (HTTPS only).
- SwiftLint in CI (MNT-01), XCTest + Swift Testing, XCUITest smoke test per flow.

### Design system (UX-05)
Generate `Car_Colors.swift` from `Design_Tokens/Design_Tokens.json` (small script `Design_Tokens/Generate_Swift.py`): navy `#0B2545`, teal `#0E8A86`, amber `#F2B544`, orange `#E8833A`, background `#F3F6FA`. Fonts: SF Pro + **IBM Plex Sans Arabic** (bundle the OFL font, register in Info.plist). Dynamic Type supported; 44 pt minimum targets (UX-03/04). Status colours fixed for every station; the station accent colour only tints headers/charts.

### Language + RTL (UX-01, SYS-04)
`App_Language` stored in UserDefaults; root view: `.environment(\.locale, Locale(identifier: code))` + `.environment(\.layoutDirection, code == "ar" ? .rightToLeft : .leftToRight)`; switch from Sign in or Settings without restart (same as Android). String Catalog (`Localizable.xcstrings`) per package. Numbers Western by default, Arabic-Indic optional per station setting.

---

## 2. Networking package (spec 12.2)
1. Generate the client from `Api_Contract/Open_Api.yaml` with **swift-openapi-generator** (build plugin), transport `URLSessionTransport`.
2. Middlewares (in order): `Locale_Middleware` (`Accept-Language`, `X-App-Version`), `Idempotency_Middleware` (adds `Idempotency-Key: UUID` to POST unless the caller supplies one — callers that retry MUST reuse the same key), `Auth_Middleware`.
3. `Auth_Middleware` = an **actor** `Token_Refresher`: on 401 `TOKEN_INVALID|TOKEN_STALE` it performs ONE refresh for all concurrent requests (single-flight `Task`), retries once, otherwise clears tokens and posts `.sessionExpired` → router shows Sign in. Never refresh on `/auth/login`.
4. Errors: decode `application/problem+json` into `Api_Problem {code, detail, status}`; map codes to localized messages in one table (same codes as Android `errorText`).
5. **Certificate pinning (SEC-03)** in Release: `URLSessionDelegate` validating the SPKI SHA-256 of the API certificate (pin the current + backup key; Mostafa gives both hashes).
6. Timeouts 15 s connect / 30 s request; no response body logging; `os_log` privacy `.private` for ids.

## 3. Security + persistence package
- `Keychain_Store`: tokens with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, service `com.carservices.session`. Never UserDefaults for secrets.
- `Session_Store`: `stationCode, stationName, deviceId, language` in UserDefaults (not secret), tokens in Keychain.
- **Unbind** ("Change station"): delete Keychain items, delete the tenant SwiftData store folder `Application Support/Tenants/<stationCode>/`, clear URLCache, then show S1.
- SwiftData store per tenant with `NSFileProtectionComplete`; one store per station code → no mixing (spec 12.3).
- `App_Switcher_Shield`: when `scenePhase != .active` show a blurred overlay with the logo (receipts, phones, finance never appear in the app switcher). No customer data in push notification text.
- App Attest / jailbreak heuristics are Omar's (`Security/Device_Integrity`) — you call `deviceIntegrity.token(nonce:)` on login and check-in.

## 4. iOS screens you own (all through view models + use cases)
Pattern: `View → @Observable ViewModel → Use_Case → Repository → (API | SwiftData)`. Each screen ships with: EN + AR screenshot test, VoiceOver labels, loading/empty/error states, idempotent retries.

| Screen | Key behaviour (server rules live in the backend — the app only mirrors them) |
|---|---|
| S1 Station binding | code field + **QR scan** with `DataScannerViewController` (VisionKit); `POST /devices/bind`; store deviceId |
| 01 Sign in | design artboard "01 Sign in"; EN/عربي toggle; MFA step when `mfaRequired`; restricted token → S2 |
| S2 Change password / 2FA | policy hints; TOTP setup shows QR from `otpauth` URI + recovery codes once |
| 02 Worker home | check-in card (from Omar's module), stats, active orders list with **server-time-based timers** (`serverNow - enteredAt`, offset from the `Date` header) |
| W1–W3, W5–W7 | workers list/filters/seat usage, 5-step add wizard, profile tabs, account & security (signed-in devices, reset password), deactivate flow with reassignment, my profile |
| S3, S4 | owner setup wizard; branches + **MapKit geofence editor** (circle radius 30–1000 m, or polygon) |
| 19, 20, 21, S12 | worker account + location, services & prices (price history, effective dates), tax & role permissions, custom roles editor |
| 22 Customer profile | header, vehicles tabs, **2D car service map** exactly like artboard 08: body outline by `bodyType`, tappable parts, colours repaired teal / replaced navy / attention orange pulsing, history sheet (`GET /vehicles/{id}/parts-map`) |
| 08, 09, 10, 11, 12 | new car form (plate prefilled from scan, Egyptian plate preview), returning-car card + "View history", history newest first with follow-up banner, problem + pick repairs (price snapshot shown read-only), order in progress (items, assignees, finish item with fix text) |
| 13, 14, 15 | checkout receipt preview, WhatsApp toggle (only if customer opted in) + Cash/Card/Split, paid confirmation with haptic success |
| 16, 17, 18, 23, 24, S11 | owner dashboard, attendance board, employee performance, finance dashboard, payments & corrections, cash drawer close |
| 25, 26, S5, S6, S7, S10 | Excel import/export (file importer, preview, confirm, undo), activity log, notifications, settings, subscription & usage, offline/sync status |

Offline (REL-06): orders and items created offline are written to SwiftData with a `clientRef` + stored `Idempotency-Key`, uploaded by `Outbox_Uploader` (BGTaskScheduler + on reconnect) in creation order; the server deduplicates. Check-in and payment confirmation are online-only (spec).

---

## 5. Backend money module (you own `Backend/src/Modules/Checkout`, `Receipts`, `Payments`, `Cash_Closures`)

Work with Ahmed A.'s `Money.ts` (decimal.js, round half-up, prices exclude tax), `@Idempotent`, `@Requires`, `Audit_Service`, `Outbox`, `Crypto_Service`.

### 5.1 Key design decision: when is the receipt number assigned?
CHK-02 requires **gap-free** numbers. If a number were assigned at checkout and the customer drove away without paying, the number would be lost (a gap). Therefore:
- **Checkout** freezes totals and moves the order to `awaiting_payment`, showing a *pro-forma* (order no., not a receipt no.).
- The **receipt number is assigned in the same database transaction that confirms the order as fully paid**. A rolled-back transaction rolls back the counter too → no gaps, no duplicates.

### 5.2 Tables (migration `<ts>_Money_Tables.sql`)
```sql
receipt_counters(tenant_id, branch_id, year int, last_value bigint NOT NULL, PRIMARY KEY (tenant_id, branch_id, year))
receipts(id, tenant_id, order_id uuid NOT NULL, receipt_no text NOT NULL, issued_at, locale, pdf_uri, image_uri,
         totals jsonb NOT NULL, e_receipt_uuid text, UNIQUE(tenant_id, order_id), UNIQUE(tenant_id, receipt_no))
payments(id, tenant_id, order_id, branch_id, method text CHECK IN ('cash','card','wallet','other'),
         amount numeric(12,2) NOT NULL CHECK (amount <> 0), currency text NOT NULL, received_by uuid NOT NULL,
         received_at timestamptz NOT NULL DEFAULT now(), business_date date NOT NULL,
         terminal_ref bytea /*ENC*/, status text CHECK IN ('confirmed','voided','refunded'),
         refund_of uuid, reason text, idempotency_key text NOT NULL, UNIQUE(tenant_id, idempotency_key))
cash_closures(id, tenant_id, branch_id, business_date, expected_cash numeric(12,2), counted_cash numeric(12,2),
              difference numeric(12,2), note text, closed_by uuid, closed_at, UNIQUE(tenant_id, branch_id, business_date))
-- all: SELECT app.enable_tenant_rls(...); composite FKs (tenant_id, order_id) -> orders
REVOKE UPDATE (amount, method, order_id) ON app.payments FROM app_rw;   -- money rows are immutable
```

### 5.3 Endpoints
| Method | Path | Permission | Rules |
|---|---|---|---|
| POST | /v1/orders/{id}/checkout | orders.create | `@Idempotent`; `If-Match` version; order must be `ready_for_checkout`; any item not `done|removed` → 409 `ORDER_HAS_OPEN_ITEMS`; recompute totals with `Money.ts`; store frozen `totals` on the order; `checkout_at=now()` (timer stops, CHK-01); status → `awaiting_payment`; outbox `OrderCheckedOut` |
| POST | /v1/orders/{id}/payments | payments.record | `@Idempotent`; body `{method, amount, terminalRef?, tenderedCash?}`; order `awaiting_payment` (lock row `FOR UPDATE`); `amount > 0`; `paid_so_far + amount ≤ grand_total` else 422 `OVERPAYMENT` (change = tendered − amount, computed by the app, never stored as revenue); card needs terminalRef (encrypted); branch drawer for today closed → 409 `DRAWER_CLOSED`; if `paid_so_far + amount == grand_total` → **same transaction**: status `paid`, `paid_at`, next `receipt_counters` value (`SELECT ... FOR UPDATE`), insert receipt `<prefix>-<yyyy>-<000123>`, outbox `OrderPaid` + `ReceiptIssued`, audit |
| POST | /v1/payments/{id}/refund | finance.correct | `{amount, reason}`; amount ≤ remaining refundable; inserts a **new** negative row `refund_of=id` (original untouched, PAY-04); order → `refunded` when fully refunded; outbox `PaymentRefunded` (accounting reversal) |
| POST | /v1/payments/{id}/void | finance.correct | only same business day and before receipt issue; reason; audit |
| GET | /v1/receipts/{id} · /v1/receipts/{id}/pdf | orders.view | pdf → signed URL 5 min |
| POST | /v1/receipts/{id}/send {channel} | payments.record | `@Idempotent`; requires customer opt-in for WhatsApp; creates `message_deliveries` via Mostafa's `Messaging_Service`; resend never creates a payment or order (CHK-04) |
| POST | /v1/cash-closures | payments.record (branch) | `{branchId, businessDate, countedCash, note}`; expected = cash payments − cash refunds of that branch/business date (tenant time zone); difference stored; one per day; reopen only by owner (audited) |
| GET | /v1/cash-closures?branch&from&to | payments.view | |

### 5.4 Receipt rendering
Consumer of `ReceiptIssued` (worker process, tenant context from the message): render HTML template (station logo, branch details, items with employee per item, subtotal, discount, tax, total, receipt no., QR for verification) in **Arabic or English per customer preference** → PDF + PNG with headless Chromium (handles Arabic shaping correctly) → upload to `tenants/{tid}/receipts/{yyyy}/{receipt_no}.pdf` → update `pdf_uri`. Target: sent within 10 s (PERF-05). E-receipt (ETA) is a `C` requirement: define `E_Receipt_Provider` interface with a no-op implementation now.

### 5.5 Tests you must write
- 2 concurrent payments completing the same order → exactly one receipt; counter has no gap (run 200 parallel orders, numbers 1..200 contiguous).
- Same `Idempotency-Key` retried 5× → one payment row.
- Overpayment, payment on `in_progress` order, refund > paid, payment from tenant B → 422 / 409 / 404.
- Split cash + card sums exactly; rounding fixtures with Ahmed A.
- Cash closure expected amount with refunds and time zone boundaries (23:59 Cairo).

---

## 6. Security checklist for your areas
- Amounts, totals, tax and receipt numbers are **server-computed only**; app values are ignored.
- No float math anywhere in money (`decimal.js` backend, `Decimal` in Swift).
- Card data: never store PAN/CVV; only the terminal/gateway reference, encrypted.
- Every money mutation: `@Requires`, `@Idempotent`, audit entry, outbox event, row lock.
- iOS: tokens only in Keychain; pinning in Release; app-switcher shield; no secrets in the bundle; ATS exceptions only in Debug.

## 7. Weekly plan
| Week | Output |
|---|---|
| 0–1 | Xcode project + packages + CI; token generator; agree `AI_Kit` protocols with Omar |
| 2–4 | Networking + Keychain + S1, 01 (incl. QR), S2, 02 |
| 5–6 | offline outbox foundation; UI tests EN/AR |
| 6–9 | W1–W3, W5–W7, S3, S4 |
| 9–12 | 19, 20, 21, 22 (car map), S12 |
| 12–14 | 08–12 |
| 14–17 | money backend (contract in week 13) |
| 17–19 | 13–15, S6; end-to-end money tests with Ahmed A. |
| 19–28 | 16–18, 23–26, S5, S7, S10, S11 |
| 29–37 | performance (Instruments), accessibility audit, pen-test fixes, TestFlight, App Store |
