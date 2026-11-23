# Setup_Guide — Backend (NestJS + Supabase) and Android (Android Studio)

Everything below is for **Windows**, matching the team's machines. Folder / file / notebook names follow
`Word1_Word2`, except names that tools force (see "Naming rule" at the end).

---

## 0. One-time tools
| Tool | Version | Check |
|---|---|---|
| Git | 2.4x | `git --version` |
| Node.js | 22 LTS | `node -v` |
| Android Studio | 2026.1+ (bundles JBR 21) | Help → About |
| Android SDK | Platform 36, Build-tools 36 | SDK Manager |
| Docker Desktop | optional (Redis / RabbitMQ from P1) | `docker -v` |
| Python | 3.11 / 3.12 for the notebooks | `python --version` |

```powershell
git clone https://github.com/AhmedADesoky/Car_Services_App.git C:\Car_Services_App
```

---

## 1. Supabase (database)

> **Security first:** a Supabase **secret key** that was ever pasted into a chat, ticket or commit must be
> rotated: Supabase Dashboard → *Project Settings → API Keys* → revoke → create a new one.
> Secret keys and DB passwords live ONLY in `Backend/.env` (git-ignored). The mobile apps never get any
> Supabase key — they only talk to our backend.

How we use Supabase:
* **PostgreSQL** with Row-Level Security, `pgvector`, `pg_trgm`, `pgcrypto`, `citext`.
* All our tables live in a private schema **`app`** that the Supabase Data API (PostgREST) does not expose.
* **Two connections:**

| Purpose | Role | Host : port | Env var |
|---|---|---|---|
| Migrations + seed | `postgres` | `aws-1-eu-west-1.pooler.supabase.com:5432` (**session** pooler) | `MIGRATION_DATABASE_URL` |
| API at runtime | `app_rw` (NOBYPASSRLS) | `aws-1-eu-west-1.pooler.supabase.com:6543` (**transaction** pooler) | `DATABASE_URL` |

The direct host `db.<ref>.supabase.co:5432` is IPv6-only and fails on many home networks — use the pooler.

---

## 2. Backend

```powershell
cd C:\Car_Services_App\Backend
npm install
copy .env.example .env      # skip if .env already exists
```
Open `Backend\.env` and fill in:
* `YOUR-DATABASE-PASSWORD` → the Supabase database password (Project Settings → Database).
* `SUPABASE_SECRET_KEY` → the **new** (rotated) secret key.
* `APP_DB_PASSWORD` and the same value inside `DATABASE_URL` → a long random password for the `app_rw` role.
* `JWT_ACCESS_SECRET` → 64 random characters.

```powershell
npm run Db_Migrate      # creates schema app, tables, RLS policies, role app_rw
npm run Db_Rls_Check    # must print "RLS coverage OK"
npm run Db_Seed         # 3 synthetic stations: ALNOUR, SPEEDFIX, DELTA1
npm run start:dev       # API on http://localhost:3000/v1
```
Check:
```powershell
curl http://localhost:3000/v1/health
```
Expected: `{"status":"ok","db":"up",...}`. Then run the isolation tests:
```powershell
npm run test:isolation
```

Seeded users in every station: `owner`, `karim.adel`, `accountant`. Their test password is
`SEED_USER_PASSWORD` in your `.env`.

### Backend layout
```
Backend/
  src/Main.ts, App_Module.ts
  src/Common/Config/App_Config.ts            env validation (zod)
  src/Common/Database/Db_Client.ts           withTenant(): BEGIN + SET LOCAL app.tenant_id
  src/Common/Tenant_Context/Tenant_Store.ts  AsyncLocalStorage
  src/Common/Auth/Tenant_Context_Guard.ts    JWT -> tenant (tid claim only)
  src/Common/Errors/Problem_Json_Filter.ts   RFC 9457 errors
  src/Modules/<Name>/<Name>_Module.ts, <Name>_Controller.ts, <Name>_Service.ts
  Database/Migrations/0001_..., 0002_..., 0003_...
  Database/Seeds/Seed_Three_Tenants.ts
  Database/Scripts/Run_Migrations.ts, Check_Rls_Coverage.ts
  Tests/Cross_Tenant/Cross_Tenant_Isolation.spec.ts
```
**Adding a tenant table:** new file `Database/Migrations/000N_<Name>.sql` with `tenant_id uuid NOT NULL`,
`UNIQUE (tenant_id, id)`, composite FKs `(tenant_id, x_id)`, then `SELECT app.enable_tenant_rls('app.<table>');`.
`npm run Db_Rls_Check` fails if you forget.

---

## 3. Android app (Android Studio)

1. Android Studio → **Open** → `C:\Car_Services_App\Android_App` → *Trust project*.
2. Gradle JDK: *Settings → Build Tools → Gradle → Gradle JDK = jbr-21* (bundled). Do not use Java 23.
3. Wait for Gradle sync (first time downloads AGP 9.2.1 / Compose).
4. Device Manager → start **Pixel_8** (or any API 34+ emulator).
5. Start the backend (`npm run start:dev`).
6. Select the **App** run configuration → ▶ Run.

Flow: **Station code** (`ALNOUR`) → **Sign in** (`karim.adel` + seed password) → **Home** shows
*API: Connected* and *Supabase DB: Connected*. Tap **EN / عربي** to switch language — the layout mirrors to RTL.

### How the app reaches the backend
| Where the app runs | BASE_URL | Set in |
|---|---|---|
| Emulator | `http://10.0.2.2:3000/v1/` (10.0.2.2 = your PC) | `App/build.gradle.kts` → `debug` |
| Real phone on same Wi-Fi | `http://<PC Wi-Fi IP>:3000/v1/` (`ipconfig`) + allow port 3000 in Windows Firewall | same |
| Release | `https://api.<your-domain>/v1/` | `release` |

Plain HTTP is allowed **only in debug** (`App/src/debug/res/xml/network_security_config.xml`).

### Module layout (spec 12.1)
```
Android_App/
  App/                 Application, Main_Activity, App_Container (DI), Navigation/App_Nav_Host
  Core_Designsystem/   Car_Colors, Car_Theme (RTL), App_Strings (EN/AR), Car_Components
  Core_Network/        Retrofit API, DTOs, Auth/Locale/Idempotency interceptors, token refresh
  Core_Security/       Keystore AES-GCM + DataStore session (device binding, tokens)
  Feature_Auth/        Bind_Screen (S1), Login_Screen (01), view models, Auth_Repository
  Feature_Home/        Home_Screen (02)
```
Pattern: Compose Screen → ViewModel (StateFlow) → Repository → API. Next modules: `Core_Database` (Room +
SQLCipher), `Core_Ai` (LiteRT), `Core_Location`, `Core_Sync` (WorkManager), `Feature_Orders`, `Feature_Plate`,
`Feature_Attendance`, `Feature_Workers`… Hilt replaces `App_Container` once KSP fully supports AGP 9 built-in Kotlin.

### Command-line build
```powershell
cd C:\Car_Services_App\Android_App
.\gradlew.bat assembleDebug
```
If Gradle fails with `Unable to establish loopback connection` (a JDK-on-Windows temp-folder issue), run once per terminal:
```powershell
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=C:\Car_Services_App\Android_App\.gradle\tmp"
```

---

## 4. AI notebooks
```powershell
cd C:\Car_Services_App\AI_Models
python -m venv .venv
.venv\Scripts\activate
pip install -r Requirements.txt
jupyter lab
```
Open `00_Environment_Setup.ipynb` first. GPU training: Kaggle (free T4 / P100) or Colab — clone the repo there.
Full model plan: `Docs/AI_Models_Plan.md`.

---

## Naming rule and its exceptions
`Word1_Word2` for every folder, source file, notebook, migration and doc we create.
Names that tools require and that therefore stay as they are:
`package.json`, `tsconfig.json`, `nest-cli.json`, `.env`, `build.gradle.kts`, `settings.gradle.kts`,
`gradle.properties`, `gradlew`, `AndroidManifest.xml`, `README.md`, `.github/workflows`, and Android
`res/` files (must be lowercase, e.g. `network_security_config.xml`). Kotlin package ids / the
applicationId (`com.carservices.app`) and the npm package name are lowercase too. Class names inside files
stay idiomatic (`class LoginViewModel` in `Auth_View_Models.kt`).
