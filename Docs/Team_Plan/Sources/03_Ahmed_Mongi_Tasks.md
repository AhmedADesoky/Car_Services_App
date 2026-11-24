<div class="cover" markdown="1">
# Ahmed Mongi — Android Lead
<div class="meta">Android team lead · Owner of the Android app architecture and every Android screen except camera / AI / location screens (Abdelrahman).<br>Reviewer for: Fares (iOS), Abdelrahman (Android AI). Your reviewer: Fares Wael.</div>
<span class="badge">ANDROID APP</span>
</div>

## 0. Starting point (already in the repo)
`Android_App/` builds with AGP 9.2.1 / Gradle 9.6 / Kotlin 2.2 / Compose. Modules: `App`, `Core_Designsystem`, `Core_Network`, `Core_Security`, `Feature_Auth`, `Feature_Home`. Working flow: Bind (S1) → Sign in (01, EN/AR + RTL) → Home (02). Tokens are AES-GCM encrypted with an Android Keystore key, refresh is automatic, every POST gets an `Idempotency-Key`, release builds set `FLAG_SECURE`.

### Deliverables
| # | Feature | Weeks | Uses (mock until ready) |
|---|---|---|---|
| 1 | Architecture: Hilt, Core_Database (Room + SQLCipher per tenant), Core_Sync, fonts, CI quality gates | 0–4 | — |
| 2 | S1 QR scan, 01 MFA step, S2 change password / 2FA, 02 full home | 1–6 | Ahmed A. auth |
| 3 | W1–W3, W5–W7, S3, S4 (map geofence editor) | 6–9 | Mostafa workers/branches |
| 4 | 19, 20, 21, 22 (2D car service map), S12 | 9–12 | Mostafa customers + catalog |
| 5 | 08–12 order flow + offline outbox | 12–16 | Ahmed A. orders |
| 6 | 13, 14, 15, S6 | 16–19 | Fares money API |
| 7 | 17, 16, 18, 23, 24, S11 | 19–26 | Mostafa reports |
| 8 | 25, 26, S5, S7, S10, biometric quick unlock | 26–28 | Mostafa |
| 9 | Performance (baseline profiles), accessibility, pinning, Play Store | 29–37 | — |

---

## 1. Architecture work (weeks 0–4)

### 1.1 Dependency injection: Hilt
`App_Container` is a temporary manual container. Move to **Hilt with KSP2** (KSP ≥ 2.3 supports AGP 9 built-in Kotlin); if the build fails, keep the container and retry each minor KSP release — constructors are already injectable. One `@Module` per core module (`Network_Module`, `Security_Module`, `Database_Module`). ViewModels become `@HiltViewModel`.

### 1.2 `Core_Database`: Room + SQLCipher, one file per tenant (spec 12.3)
- DB file name `tenant_<stationCode>.db` under `noBackupFilesDir`; passphrase = 32 random bytes generated once, stored **encrypted with the Keystore key** (`Keystore_Cipher`) in DataStore.
- Unbind (`SessionStore.unbind()`): close DB → delete the file + passphrase → destroy key (already destroys the key).
- Entities for offline: `Order_Entity`, `Order_Item_Entity`, `Outbox_Entity(id, method, path, bodyJson, idempotencyKey, createdAt, attempts, lastError)`, cached `Service_Entity`, `Customer_Summary_Entity` (no phone numbers offline except masked).
- Schema migrations exported (`room.schemaLocation`) and tested with `MigrationTestHelper`.

### 1.3 `Core_Sync`: WorkManager outbox (REL-06)
- Every offline-capable call (create order, add/finish item, attachments) is written to `Outbox_Entity` **with its Idempotency-Key and the order `clientRef`** in the same Room transaction as the local change.
- `Outbox_Worker` (unique work, `NetworkType.CONNECTED`, exponential backoff 30 s → 15 min) sends items **in creation order**, reusing the stored key; 2xx or 409 `VEHICLE_HAS_OPEN_ORDER`/replayed → delete; 4xx validation → mark failed and show in S10; 5xx / network → retry.
- Check-in, check-out and payments are **online only** (security) — disable those buttons offline with a clear message.
- Server time: `Server_Clock` reads the HTTP `Date` header of every response and keeps an offset; timers on 02/12 use `serverNow - enteredAt` (never the phone clock, which workers can change).

### 1.4 Design system completion
- Add **Roboto Flex** and **Noto Kufi Arabic** to `Core_Designsystem/src/main/res/font/` (lowercase file names required: `roboto_flex.ttf`, `noto_kufi_arabic.ttf`, OFL licence) and switch `CarFont`.
- Components from the artboards: plate chip (Kuwaiti plate: الكويت/KUWAIT strip, code | number in Arabic + English digits), status pill, order card with progress, stat card, bottom navigation (Home, Orders, Customers, Profile), segmented filters, bottom sheet, empty / error states.
- Fix: the segmented EN/عربي toggle shape looks wrong in RTL — use `SegmentedButtonDefaults.itemShape(index, count)` with `LocalLayoutDirection` aware ordering, or a custom pill.
- Motion from the design note: shared-axis X 300 ms between screens, fade-through 200 ms, 8 px rise + 40 ms stagger (max 6 items), respect "Remove animations".

### 1.5 Quality gates in CI (with Mostafa)
ktlint (disable `filename` rule — files are `Word_Word`), detekt, unit tests (`Turbine` for flows), Compose UI tests for every screen in EN and AR, `assembleRelease` with R8 on every PR.

### 1.6 Network hardening
- Release: OkHttp `CertificatePinner` for the API host with **two** SPKI pins (current + backup) from Mostafa; debug unpinned.
- Add `Server_Clock` interceptor; map new problem codes in one `Error_Text.kt` shared by features (move `errorText` out of `Feature_Auth`).

---

## 2. Screens (Android) — each one = Compose screen + ViewModel (StateFlow) + Repository + tests

| Screen | Details you must implement |
|---|---|
| **S1** QR | CameraX + ML Kit barcode scanning (bundled model) reading `carservices://bind?code=ALNOUR`; validate code format `^[A-Z0-9]{4,12}$` before calling the API; manual code fallback |
| **01** MFA | when login returns `mfaRequired`, show 6-digit OTP step (auto-fill from authenticator is not possible → numeric keyboard, paste support); restricted token → S2 |
| **S2** | change password with live policy hints; 2FA setup (QR from `otpauth://`, recovery codes shown once with "I saved them" checkbox) |
| **02** home | check-in card (state from Abdelrahman's module), stats, active orders "Mine / All branch" filter, FAB "Scan plate" → Abdelrahman's screen 07, bottom nav by role |
| **W1** workers list | search, filters (branch, status, role), seat usage `8 / 10`, status chips; paging with cursor |
| **W2** add / edit wizard | 5 steps (personal, employment + branch, account + role, schedule, review); username suggestion; phone E.164 validation; national ID only visible to owner; send invite |
| **W3** profile | tabs Overview, Attendance, Work, Performance, Documents (signed URL viewer), Account & Security, Activity log |
| **W5** account & security | reset password, reset face (→ W4 by Abdelrahman), signed-in devices with Sign out, suspend / deactivate with confirmations |
| **W6** deactivate | reason, end date, list of open items to reassign (must all be reassigned before submit) |
| **W7** my profile | own details (editable: photo, phone, emergency contact, language), change password, my attendance + work this month |
| **S3** setup wizard | station details, tax rate, first branch |
| **S4** branches | list + **Google Maps Compose** geofence editor: draggable center, radius slider 30–1000 m (default 100), optional polygon; show warning if radius < 50 m (GPS accuracy) |
| **19, 20, 21, S12** | worker account + location, services & prices (add price with effective date, history list), tax rates + role permissions matrix, custom roles editor (disabled on Basic plan) |
| **22** customer profile | header, call button (`ACTION_DIAL`), vehicle tabs, **2D car service map** from artboard 08 (Compose `Canvas`, body outline per `bodyType`, 14 tappable parts as `Modifier.clickable` boxes with semantics labels, colours repaired/replaced/attention + pulsing attention, bottom sheet history) |
| **08** new car | plate (from scan, editable with Kuwaiti plate preview: code 1-2 digits + number up to 5 digits), make/model pickers, customer name + phone, consent switch for WhatsApp (CUS-05) |
| **09 / 10** | returning car card + View History; history newest first, follow-up banner |
| **11** problem + repairs | problem text, optional voice note (MediaRecorder, ≤ 2 min) + photos (≤ 10), searchable service list with prices (read-only snapshot), assignees picker |
| **12** order in progress | items with assignees, finish item (fix performed text + outcome + car part), live timer, add item, cancel (managers) |
| **13 / 14 / 15** | receipt preview from checkout response, WhatsApp send toggle (hidden if no opt-in), Cash / Card / Split (amount fields with exact remaining), tendered cash → change, paid screen |
| **16, 17, 18, 23, 24, S11** | owner dashboard, attendance board, employee performance, finance dashboard (charts: Vico or Compose Canvas), payments & corrections (refund flow with reason), cash drawer close |
| **25, 26, S5, S6, S7, S10** | Excel import (SAF file picker → upload → preview counts + row errors → confirm → undo within 24 h) and export, activity log, notifications centre, settings (language, receipt, WhatsApp/payment connection status), subscription & usage, offline/sync status |

### Biometric quick unlock (AUTH-06)
Optional per user: after 5 min in background require `BiometricPrompt` (BIOMETRIC_STRONG or device credential) before showing data. It only unlocks the local session — it never replaces server check-in verification.

---

## 3. Security checklist (Android, MASVS L2)
- No secrets in the APK (no Supabase keys, no API keys); `BuildConfig` contains only the base URL.
- Tokens + DB passphrase only encrypted with Keystore; `allowBackup=false` (already), data in `noBackupFilesDir`.
- `FLAG_SECURE` on release (done); push notification text without customer data ("New order assigned").
- Validate all input on the client for UX, but **never rely on it** — the server validates again.
- Deep links (`carservices://bind`) only accept the bind code; never auto-submit login.
- WebViews: none. Exported components: only the launcher activity.
- R8 enabled in release; keep rules for kotlinx.serialization (already in `proguard-rules.pro`).

## 4. Tests
ViewModel unit tests ≥ 60 % (MNT-01) with fake repositories; Compose UI tests per screen in EN and AR; one end-to-end instrumented test (bind → login → create order → finish item → checkout → pay cash) against the staging backend before each release.

## 5. Weekly plan
| Week | Output |
|---|---|
| 0–2 | Hilt (or keep container), Core_Database, Core_Sync skeleton, fonts, CI gates |
| 3–6 | S1 QR, 01 MFA, S2, 02 full, server clock, pinning |
| 6–9 | W1–W3, W5–W7, S3, S4 |
| 9–12 | 19–22, S12 (car map) |
| 12–16 | 08–12 + offline outbox end-to-end |
| 16–19 | 13–15, S6 |
| 19–26 | 16–18, 23, 24, S11 |
| 26–28 | 25, 26, S5, S7, S10, biometric unlock |
| 29–37 | baseline profiles (cold start < 2 s), accessibility audit (TalkBack, contrast), pen-test fixes, Play Console internal → production |
