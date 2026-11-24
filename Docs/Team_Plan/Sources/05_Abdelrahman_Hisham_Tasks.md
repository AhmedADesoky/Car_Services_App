<div class="cover" markdown="1">
# Abdelrahman Hisham — Android AI, Camera & Location
<div class="meta">Android team · App-side owner of on-device AI (LiteRT), camera, location, Play Integrity and the Android screens 07 (scan plate), 03–06 (check-in / check-out), W4 (face enrollment).<br>Model training (plate + face) is in the separate <b>07_AI_Models_Work_Plan.pdf</b>. Reviewer for: Omar. Your reviewer: Ahmed Mongi.</div>
<span class="badge">ANDROID AI · FEATURES</span>
</div>

## 0. How your two tracks fit together
- **Feature track (this PDF):** the Android modules `Core_Ai`, `Core_Location`, `Core_Integrity`, and screens 07, 03, 04, 05, 06, W4. They work from week 1 with **fake engines**, so Ahmed Mongi and the backend never wait for the models.
- **Model track (AI PDF):** training the plate and face models. When a model package is ready, it drops into `Core_Ai` without changing any screen.

### Deliverables
| # | Feature | Weeks |
|---|---|---|
| 1 | `Core_Ai` interfaces + fake engines + model package loader (verify signature, decrypt) | 1–4 |
| 2 | `Core_Location`: fused location, mock detection, geofence math, shift foreground service | 4–9 |
| 3 | `Core_Integrity`: Play Integrity token bound to the server nonce | 6–9 |
| 4 | Screen 07 Scan plate (CameraX, live detection, best-3 voting, server fallback, manual edit) | 10–16 |
| 5 | Screen W4 Face enrollment (guided capture, quality gates, liveness per frame) | 8–12 |
| 6 | Screens 03–06 Check-in / confirmed / refused / check-out summary | 19–23 |
| 7 | On-device benchmarks + battery tests (PERF-02, PERF-03) | 20–30 |

---

## 1. `Core_Ai` module (LiteRT)

### Interfaces (agree the same shapes with Omar for iOS in week 1)
```kotlin
interface PlateReader {           // screen 07
    suspend fun read(frame: ImageProxy): PlateReading?        // null = no plate in frame
}
data class PlateReading(val text: String, val normalized: String, val confidence: Float,
                        val plateType: String, val crop: Bitmap, val modelVersion: String)

interface FaceEngine {            // W4 + check-in
    suspend fun analyze(frame: ImageProxy): FaceAnalysis      // quality + landmarks
    suspend fun embed(aligned: Bitmap): FloatArray            // 512-d, for instant local feedback only
}
interface LivenessEngine {
    suspend fun passiveScore(frame: Bitmap, face: FaceBox): Float           // MiniFASNet x2.7 + x4.0 ensemble
    fun activeChallenge(prompts: List<String>): Flow<ChallengeState>        // blink / turn / smile
}
```
- `Fake_Plate_Reader` (returns `ق ص ر ١٤٢٧` after 600 ms), `Fake_Face_Engine`, `Fake_Liveness_Engine` — **debug builds only** (put them in `src/debug/`, so release can never ship them).
- `Plate_Normalizer.kt`: port of `AI_Models/Common_Utils/Plate_Normalizer.py` with the **same unit-test vectors** (keep both in sync; the backend has a TypeScript port too).

### Model package loader (AI-05)
1. After login: `GET /v1/ai/models` (Omar's API) → active versions per kind. If the local version differs → `GET /v1/ai/models/{kind}/package` → signed URL + `packageKey` (base64, delivered only over the authenticated TLS call).
2. Download in WorkManager (Wi-Fi preferred, resumable) to `noBackupFilesDir/models/<tenant>/<kind>/<version>/`.
3. **Verify the Ed25519 signature** of the package manifest with the platform public key embedded in the app (`res/raw/model_signing_public_key.bin`) — reject on mismatch.
4. Decrypt model files (AES-256-GCM with `packageKey`), keep `packageKey` encrypted with the Keystore key; load into LiteRT `Interpreter` with GPU delegate if supported, else XNNPACK (4 threads).
5. Keep the previous version until the new one loads; delete older versions. Unbinding wipes the whole tenant folder.

---

## 2. Screen 07 — Scan plate (VEH-01..04, PERF-02 < 1.5 s)
1. CameraX `Preview` + `ImageAnalysis` (720p, `STRATEGY_KEEP_ONLY_LATEST`), torch toggle, scan-line animation from the design (respect reduced motion).
2. Sample a frame every **150 ms** → `PlateReader.read` → keep the 3 sharpest crops (Laplacian variance) of the same plate → majority vote on `normalized`.
3. Confidence ≥ 0.85 → show the result card (plate chip with EGYPT/مصر band) for confirmation. Below 0.85 → upload the best crop to `POST /v1/plates/recognize` (Mostafa) with a 2 s timeout → show the server result. If it is still low, or the AI service is down (`AI_UNAVAILABLE`), open **manual entry** with the Egyptian plate keyboard (17 letters + Arabic-Indic digits). REL-04: scanning must never block creating an order.
4. On confirm: `POST /v1/plates/scans {predictedText, finalText, confidence, modelVersion, ranOn}`; if the worker corrected the text → also upload the crop through the signed URL (`/v1/uploads/plate-image`) so it can become a training sample for **this station only**.
5. Then navigate: known plate → screen 09 (Mongi), new plate → 08 (Mongi) with the plate prefilled. Hand over to Mongi's screens through a navigation contract (`ScanResult(plateText, plateScanId, vehicleId?)`).
6. Camera permission flow with rationale; images are never saved to the gallery.

## 3. Screen W4 — Face enrollment (spec 11.2, 7.3)
1. Front camera, oval guide, live quality feedback from `FaceEngine.analyze`: exactly one face, eye distance > 80 px, sharpness, exposure, yaw/pitch < 20° (same thresholds as `07_Face_Enrollment_Quality_Gates.ipynb`).
2. Capture 3–5 frames at different angles (front, slight left, slight right); passive liveness must pass on each; one active prompt (blink).
3. Show the **consent screen first** (PRV-01): text from the owner, worker taps "I agree"; the consent id is sent with the enrollment.
4. Upload `POST /v1/workers/{id}/face/enrollments` (Omar's endpoint, multipart, `@Idempotent`): aligned 112×112 face crops + per-frame liveness scores. The **server** computes the embeddings and stores encrypted templates; the phone deletes the frames right after the upload succeeds.
5. Success screen with progress 1–5 from the design.

## 4. `Core_Location` (ATT-01, ATT-04, ATT-05)
- Fused Location Provider, `PRIORITY_HIGH_ACCURACY`, a single fresh fix (max age 10 s) for check-in; reject the fix if accuracy > 50 m (show "move outside / wait for GPS").
- Mock detection: `location.isMock` (API 31+) / `isFromMockProvider` (API 26–30) → send `mockLocation=true` (the server refuses). Also send the Play Integrity verdict.
- Geofence math (`Geofence.kt`): Haversine distance + point-in-polygon, used only for UI feedback ("you are 340 m from Main Workshop") — **the server decides**.
- Shift pings: a **foreground service** of type `location` (Android 14 needs `FOREGROUND_SERVICE_LOCATION` + a visible notification "Shift active") running only between check-in and check-out. Every 10 min (tenant setting) take a balanced-power fix, queue it in Room, send batches to `POST /v1/attendance/pings` (≤ 50 per call). Stop the service at check-out or when the server reports the record is closed.
- Permissions: `ACCESS_FINE_LOCATION` at check-in; ask for background location only if the station enables time-outside tracking, with the Play-policy disclosure screen. Never collect location outside a shift (PRV-02).

## 5. `Core_Integrity` — Play Integrity (SEC-09)
- Standard Integrity API: `prepareIntegrityToken` at app start (cloud project number in `BuildConfig`), then `request(requestHash = SHA-256(nonce))` using the nonce from `POST /v1/attendance/challenge`.
- Send the token with login and check-in; Ahmed A.'s `Device_Integrity_Service` decodes it on the server and checks the package name, certificate digest, `MEETS_DEVICE_INTEGRITY` and the requestHash. Rooted / emulated devices are blocked for check-in.

## 6. Screens 03–06 — Check-in / check-out (ATT-01..06, PERF-03 < 4 s)
1. 03: `POST /v1/attendance/challenge {type}` → nonce + 2 prompts + thresholds.
2. In parallel: get the location fix (section 4) and the integrity token (section 5).
3. Camera: run the active prompts (`LivenessEngine.activeChallenge`) + passive score; show instant feedback from the device models.
4. Send `POST /v1/attendance/check-in` (multipart): nonce, lat, lng, accuracy, mockLocation, integrityToken, livenessDeviceScore, promptsPassed, and **one JPEG frame** (≤ 300 KB, face area). The server re-checks everything and decides.
5. 04 confirmed (time, branch, haptic success) · 05 refused with the reason from the server code (`outside_area`, `face_mismatch`, `liveness_failed`, `mock_location`, `low_accuracy`, `integrity`, `no_template`) plus what to do next · 06 check-out summary (time on site, outside minutes).
6. Online only. On network loss mid-request, retry with the **same Idempotency-Key and nonce** until the nonce expires (60 s), then start over.

## 7. Security checklist for your areas
- The device result is a hint; the **server** decides check-in. Never send a "passed" boolean the server trusts alone.
- Frames are never stored on the phone (memory only) and never logged.
- Fake engines exist only in `src/debug/`. Add a unit test that fails if the release variant contains a class named `Fake_*`.
- Model files are verified (signature) before loading; a tampered package is deleted.
- Location only during a shift; foreground notification always visible.

## 8. Weekly plan (feature track; model work in the AI PDF)
| Week | Output |
|---|---|
| 1–4 | Core_Ai interfaces + fakes + loader skeleton; Plate_Normalizer.kt with test vectors |
| 4–9 | Core_Location, Core_Integrity |
| 8–12 | W4 face enrollment (with fake engine, then real) |
| 10–16 | Scan plate 07 (fake → plate v1 model) |
| 19–23 | Check-in screens 03–06 end-to-end with Ahmed A.'s API |
| 20–30 | device benchmarks (Galaxy A-series 2023), battery test of the shift service, field tests |
