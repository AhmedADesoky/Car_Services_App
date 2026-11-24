<div class="cover" markdown="1">
# Omar Mohamed — iOS AI, AI Registry & Inference Service
<div class="meta">iOS team · App-side owner of on-device AI on iOS (Core ML + Vision), iOS location, App Attest and the iOS screens 07, 03–06, W4 · Backend owner of the AI module (model registry, packages, face templates, training samples) and of the internal AI Inference Service.<br>Model training (liveness + MLOps) is in the separate <b>07_AI_Models_Work_Plan.pdf</b>. Reviewer for: Abdelrahman. Your reviewer: Fares (iOS), Abdelrahman (AI).</div>
<span class="badge">iOS AI · AI BACKEND</span>
</div>

## 0. Deliverables
| # | Feature | Weeks |
|---|---|---|
| 1 | `AI_Kit` protocols (same shapes as Android) + fake engines + package loader | 1–4 |
| 2 | Backend AI module: tables, registry API, packages, base-model assignment | 4–10 |
| 3 | Face templates: enrollment endpoint + encrypted storage + deletion | 8–12 |
| 4 | iOS `Location` + `Device_Integrity` (App Attest) + server verifier | 6–12 |
| 5 | iOS W4 face enrollment | 9–12 |
| 6 | iOS 07 scan plate | 12–16 |
| 7 | **Inference Service** (FastAPI + ONNX Runtime) + `Inference_Client` in the backend | 14–20 |
| 8 | iOS 03–06 check-in / check-out | 19–23 |
| 9 | AI page S8 API + training-sample pipeline + fine-tune / rollback API | 26–31 |

---

## 1. `AI_Kit` (iOS, Core ML + Vision)
- Protocols `Plate_Reader`, `Face_Engine`, `Liveness_Engine` with the same inputs/outputs as Android (`Core_Ai`), so the backend sees identical payloads.
- Implementations: plate detector + CRNN as `.mlpackage` (from the AI notebooks), Vision `VNDetectFaceLandmarksRequest` / YuNet Core ML for detection + 5 points, MobileFaceNet `.mlpackage` for local embeddings, MiniFASNet ×2 for passive liveness, active prompts from Vision landmarks (eye aspect ratio for blink, yaw from landmarks) or MediaPipe Face Landmarker for iOS — use the **same thresholds** as notebook `04_Liveness_Active_Prompts`.
- Fakes only in the Debug configuration (`#if DEBUG`), plus a unit test that fails if Release links a `Fake_*` type.
- Package loader: same flow as Android — `GET /v1/ai/models`, download, **verify the Ed25519 signature** with the public key in the bundle (CryptoKit `Curve25519.Signing`), decrypt AES-GCM (`CryptoKit.AES.GCM`) with the `packageKey` (kept in Keychain), compile with `MLModel.compileModel(at:)` and store in `Application Support/Tenants/<code>/Models/` (`NSFileProtectionComplete`).

## 2. iOS `Location` + `Device_Integrity`
- CoreLocation, `kCLLocationAccuracyBest` for check-in, reject accuracy > 50 m, **`location.sourceInformation?.isSimulatedBySoftware`** → `mockLocation=true` (ATT-04).
- Shift updates: `CLLocationManager` significant-change + a timer while the app is active, `allowsBackgroundLocationUpdates` only during a shift, with the blue status indicator. Pings in batches to `/v1/attendance/pings`.
- **App Attest** (SEC-09): `DCAppAttestService.generateKey` once per install → `attestKey(keyId, clientDataHash: SHA256(serverChallenge))` → `POST /v1/devices/attest`. Then for login and check-in: `generateAssertion(keyId, clientDataHash: SHA256(nonce))`.
- **Server side (you write it, Ahmed A. calls it):** `Backend/src/Modules/Ai/App_Attest_Verifier.ts` — verify the attestation certificate chain to Apple's App Attest root CA, the App ID (`<TeamID>.com.carservices.app`), the counter, the `credCertificate` nonce, then store the public key per device; verify each assertion signature and that the counter increases (replay protection). Use a maintained library (e.g. `node-app-attest`) and pin the Apple root certificate in the repo.

## 3. Backend AI module (`Backend/src/Modules/Ai/`)

### Tables (migration `<ts>_Ai_Tables.sql`)
```sql
ai_base_models(id, kind text CHECK IN ('plate','face','liveness'), version text, artifact_uri text,
               metrics jsonb, training_data_card text, status text CHECK IN ('candidate','released','retired'))   -- platform table
tenant_ai_models(id, tenant_id, kind, version, base_model_id, artifact_uri, package_key bytea /*ENC*/,
                 config jsonb /* thresholds */, metrics jsonb, status text CHECK IN ('candidate','active','retired'),
                 activated_at, UNIQUE(tenant_id, id))
CREATE UNIQUE INDEX one_active_model ON app.tenant_ai_models (tenant_id, kind) WHERE status = 'active';
face_templates(id, tenant_id, worker_id, embedding bytea /*ENC, 512 float32*/, model_version, quality_score real,
               enrolled_by, consent_id uuid NOT NULL, revoked_at, created_at)
ai_training_samples(id, tenant_id, kind, source_id, image_uri, label text, split text CHECK IN ('train','val','test'),
                    consent_scope text NOT NULL DEFAULT 'tenant_only', created_at)
ai_training_jobs(id, tenant_id, kind, status, dataset_snapshot jsonb, started_at, finished_at, metrics jsonb, promoted bool, logs_uri)
ai_inference_logs(id, tenant_id, kind, model_version, ran_on, latency_ms int, confidence real, outcome text, at)  -- no images, ever
-- all tenant tables: enable_tenant_rls
```

### Endpoints
| Method | Path | Permission | Rules |
|---|---|---|---|
| GET | /v1/ai/models | any signed-in | active version + config per kind (fallback: released base model) |
| GET | /v1/ai/models/{kind}/package | any signed-in | signed URL (5 min) to `tenants/{tid}/models/{kind}/{version}/package.zip` + `packageKey` (decrypted from ENC); rate limited 10/hour/device |
| POST | /v1/workers/{id}/face/enrollments | workers.face.enroll | `@Idempotent`; multipart 3–5 aligned 112×112 JPEG crops + liveness scores + `consentId`; server: `Inference_Client.livenessCheck` per frame + `embedFace` per frame → reject frames under thresholds → **duplicate check against templates of the same tenant only** (cosine > threshold with another worker → 409 `FACE_BELONGS_TO_OTHER_WORKER`) → average → encrypt → store; frames discarded; audit |
| DELETE | /v1/workers/{id}/face | workers.face.enroll | reason; sets `revoked_at`, deletes the embedding bytes; worker must re-enroll |
| GET | /v1/ai/accuracy | settings.manage | S8: plate accuracy 30 days (1 − correction rate), number of corrections, version, last update |
| POST | /v1/ai/models/{kind}/fine-tune | settings.manage | plan must allow fine-tune; needs ≥ 300 new corrected samples → creates `ai_training_jobs` (job runs in the isolated trainer, AI PDF) |
| POST | /v1/ai/models/{kind}/rollback | settings.manage | activates the previous version in one transaction (unique index guarantees one active) |
| internal | `Face_Template_Service.templatesOf(workerId)` | — | used by Ahmed A.'s check-in: decrypts in memory only, never returned by any API |

Templates are **never exported** (not in Excel, not in data export) and are deleted 30 days after a worker is deactivated (job).

## 4. AI Inference Service (`AI_Models/Inference_Service/`)
Decision (overview section 7): a **separate internal Python service**, called **only** by the backend.

### API (private network, not on the internet)
| Endpoint | Input | Output |
|---|---|---|
| POST /plate/recognize | `tenantId, modelVersion`, JPEG crop | `{text, normalized, confidence, latencyMs}` |
| POST /face/embed | `tenantId, modelVersion`, aligned 112×112 JPEG | `{embedding: float[512]}` |
| POST /liveness/check | `tenantId, modelVersion`, face JPEG + box | `{score, latencyMs}` |
| GET /health · GET /ready | — | model load status |

### Implementation
- `Inference_Main.py` (FastAPI, uvicorn, 2 workers), `Model_Router.py` (LRU cache of ONNX `InferenceSession`s keyed by `(kind, version)`; downloads + verifies + decrypts packages like the apps), `Preprocess.py` that imports the **same functions** as the training notebooks (no drift).
- Auth: every request must carry `Authorization: Bearer <INFERENCE_SERVICE_TOKEN>` (shared secret from the secret manager, rotated 90 days) — or mTLS on the internal network. Requests without it → 401. Bind to the private network only.
- Limits: body ≤ 2 MB, image decode with Pillow `MAX_IMAGE_PIXELS` guard, 2 s timeout per request, max concurrency per instance; **never write images to disk**, never log them.
- Deployment: Docker (`python:3.11-slim`, onnxruntime CPU), same region as the API, autoscale on CPU; GPU not needed for inference at launch (ViT-S liveness ≈ 40–80 ms on CPU).
- Backend side: `Inference_Client.ts` with timeout 2 s, retry once on 503, **circuit breaker** (open for 30 s after 5 failures → callers fall back: manual plate entry; check-in returns 503 `AI_UNAVAILABLE` and the manager can approve a manual check-in, ATT-11), and writes `ai_inference_logs`.

## 5. iOS screens you own
| Screen | Notes |
|---|---|
| W4 Face enrollment | AVFoundation front camera, oval guide, quality feedback, consent screen first, 3–5 frames, upload, success |
| 07 Scan plate | `AVCaptureVideoDataOutput` 720p, 150 ms sampling, best-3 vote, server fallback < 0.85, manual Egyptian plate keyboard, matched-geometry plate chip into the order header (design note), then hand over to Fares's 08/09 |
| 03–06 Check-in | same sequence as Android (challenge → location + App Attest assertion → active + passive liveness → one frame → server decision), haptics on success, reason screen on refusal |
| S8 AI page | API only (Fares builds the screen on iOS, Mongi on Android) |

## 6. Security checklist
- Biometric data (PRV-01): only templates are stored, encrypted with the tenant key; frames are never stored; written consent required before enrollment.
- 1:1 matching inside one tenant only; there is no endpoint that searches faces across workers, except the same-tenant duplicate check at enrollment.
- Model packages signed (Ed25519) + encrypted (AES-GCM); verify before load on phones AND in the inference service.
- Inference service unreachable from the internet; shared-secret / mTLS auth; inputs bounded.

## 7. Weekly plan
| Week | Output |
|---|---|
| 1–4 | AI_Kit protocols + fakes; agree payloads with Abdelrahman; package format spec (manifest.json, signature, files) |
| 4–10 | AI tables + registry endpoints + base model assignment at tenant creation |
| 6–12 | Location, App Attest + server verifier; face templates endpoint; W4 iOS |
| 12–16 | 07 iOS |
| 14–20 | Inference service v1 + Inference_Client + circuit breaker + deploy to dev |
| 19–23 | 03–06 iOS with Ahmed A.'s attendance API |
| 26–31 | accuracy API, training-sample pipeline, fine-tune + rollback API |
