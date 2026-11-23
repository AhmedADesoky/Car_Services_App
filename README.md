# Car_Services_App

Multi-tenant SaaS for vehicle service stations: native **Android** (Kotlin + Jetpack Compose) and **iOS**
(SwiftUI) apps, a **NestJS** backend on **Supabase PostgreSQL** with Row-Level Security, and three AI
models: license-plate recognition, face recognition and face liveness.

| Folder | What |
|---|---|
| [Backend](Backend) | NestJS Core API, SQL migrations, seed, isolation tests |
| [Android_App](Android_App) | Android Studio project (multi-module) |
| [iOS_App](iOS_App) | SwiftUI app (iOS team) |
| [AI_Models](AI_Models) | Jupyter notebooks + shared Python utilities |
| [Api_Contract](Api_Contract/Open_Api.yaml) | OpenAPI 3.1 contract shared by both apps |
| [Design_Tokens](Design_Tokens/Design_Tokens.json) | colours / typography from the designs |
| [Docs](Docs) | [Setup_Guide](Docs/Setup_Guide.md) · [Implementation_Plan](Docs/Implementation_Plan.md) · [AI_Models_Plan](Docs/AI_Models_Plan.md) |

**Start here:** [Docs/Setup_Guide.md](Docs/Setup_Guide.md).

Secrets (`Backend/.env`, `kaggle.json`, keystores) are git-ignored and must never be committed.
