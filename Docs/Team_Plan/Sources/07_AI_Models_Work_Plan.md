<div class="cover" markdown="1">
# AI Models Work Plan — Plate · Face · Liveness
<div class="meta">Separate track, runs in parallel with all app and backend work.<br>Abdelrahman Hisham: Model 1 (plate) + Model 2 (face) · Omar Mohamed: Model 3 (liveness) + per-station MLOps / registry.<br>Notebooks: <code>AI_Models/</code> (21 notebooks, already in the repo) · Code utilities: <code>AI_Models/Common_Utils/</code></div>
<span class="badge">AI TRACK</span>
</div>

## 1. Decision: how the models are used in production

### 1.1 Recommended architecture (hybrid)
```
            ┌──────────── phone ────────────┐
 camera ──► │ LiteRT / Core ML (first pass) │──► instant result on screen
            └──────────────┬────────────────┘
                           │ HTTPS + JWT (tenant from token)
                           ▼
                  Core API (NestJS)  ── checks permission, plan quota, audit, idempotency
                           │ private network + service token
                           ▼
          AI Inference Service (Python FastAPI + ONNX Runtime)   ← NOT on the internet
             Model_Router: (tenant, kind) -> station's active version
```

### 1.2 Why not the alternatives
| Option | Decision | Reason |
|---|---|---|
| Run ONNX inside the NestJS API process | No | inference is CPU-bound and blocks Node's single event loop → every station's API slows (noisy neighbour, SCL-04); pre-processing would be re-written in TypeScript and drift from training; a model crash or memory spike takes down the whole API; cannot scale AI separately |
| Let the apps call an AI API directly | No | the backend must stay the only gate that checks the tenant from the JWT, permissions, quotas, audit; an exposed AI endpoint could be abused to query other stations' models |
| Third-party AI cloud API for faces | No | biometric data = sensitive personal data under Kuwait's CITRA Data Privacy Protection Regulation (verify the current version with legal counsel); no control over residency / retention / tenant isolation; per-call cost |
| **Internal Inference Service + on-device first pass** | **Yes** | same Python code as training; independent scaling; failure isolation with graceful fallback (manual plate entry, manager-approved check-in); server re-checks face + liveness so a hacked phone cannot fake check-in |

### 1.3 Where each model runs
| Model | On device | On server | Who decides |
|---|---|---|---|
| Plate detector + CRNN | always (< 1.5 s) | PARSeq fallback when confidence < 0.85 | worker confirms the text |
| Face embedding | MobileFaceNet (instant feedback) | IResNet-50 teacher **or** the same MobileFaceNet (must be the version the templates were made with) | **server** 1:1 match |
| Liveness | active prompts + MiniFASNet ×2 | ViT-S (DINOv2 + LoRA) on one frame | **server**, fused score |

### 1.4 Hosting
- Inference: Docker `python:3.11-slim` + `onnxruntime` (CPU) on the same cloud and region as the API (eu-west-1). 2 instances, autoscale on CPU. GPU is not needed at launch.
- Training: Kaggle (free GPU ~30 h/week) / Colab Pro for research; later per-station fine-tunes on an on-demand GPU container (one job = one tenant, destroyed afterwards).
- Model artefacts: Supabase Storage private bucket — base models under `platform/models/<kind>/<version>/`, station models under `tenants/<tenant_id>/models/<kind>/<version>/`.

### 1.5 Model package format (shared by Android, iOS and the inference service)
```
package.zip
  manifest.json      {kind, version, files:[{name, sha256}], input specs, thresholds, created_at}
  manifest.sig       Ed25519 signature of manifest.json (platform signing key, kept offline / in KMS)
  *.tflite / *.mlpackage / *.onnx   (each AES-256-GCM encrypted with the package key)
```
The verifier rejects a package whose signature or any file hash does not match.

---

## 2. Model 1 — License plate recognition (owner: Abdelrahman)

### Targets (spec 11, AI-Q1)
≥ 95 % exact match in daylight, ≥ 90 % at night / rain, per station test set · detector mAP50 ≥ 0.97 · on-device < 15 MB, < 1.5 s.

### Most robust architecture
| Stage | Model | Why |
|---|---|---|
| Detection | **YOLO11n-pose** (640 px, 5 plate types + 4 corner keypoints → warp to the canonical Kuwaiti layout) | best accuracy/latency for phones; exports to TFLite int8 / Core ML / ONNX. Licence AGPL-3.0 → buy the Ultralytics licence for a closed commercial app, or use **YOLOX-Tiny (Apache-2.0)** with the same pipeline |
| Recognition (device) | **CRNN** on 4 cells (code/number × Arabic/English digits): MobileNetV3-Small → 2× BiLSTM(96) → CTC over ٠-٩ + 0-9 | tiny (≈1 M params, ≈3 MB int8); digits only |
| Recognition (server) | **PARSeq** (permuted autoregressive ViT, Apache-2.0) | state-of-the-art scene-text accuracy on blur/dirt/angles; only for low-confidence crops |
| Post-processing | **Arabic/English row cross-check** per cell + best-3 frame vote + `Plate_Normalizer` (`12-34567`) | two independent readings of every value: disagreement → fallback |

### Data (best available, in priority order)
1. **Kuwaiti pilot-station capture** (owner's written consent): 3–5 k frames from real bays, day / night / summer glare, labelled with box + 4 corners + `CODE-NUMBER` in **CVAT** or **Label Studio**.
2. Public Kuwait / GCC plate sets on Kaggle / Roboflow Universe (verify the licence of each).
3. **Open Images v7 – "Vehicle registration plate"** (CC-BY 4.0) — thousands of plates worldwide, to pre-train the detector.
4. **Synthetic Kuwaiti plates (100 k+)** from notebook 02: the canonical layout (strip + code + number, Arabic and English rows), OFL fonts, colours per type, perspective, motion blur, night, rain, glare, dirt, JPEG artefacts — fixes rare types and night images.
5. More field data from each new station (corrections flow), always inside that station's storage prefix.
6. Per-station corrected scans (only for that station's fine-tune).
Split by **plate key** (`stable_split`) — the same car never appears in train and test.

### Notebook steps
| Notebook | Do | Done when |
|---|---|---|
| 01_Plate_Dataset_Preparation | one adapter per source → YOLO-pose labels (box + 4 corners) + `plates.yaml`; warp + cut the 4 cells | counts per split printed; no plate text in two splits |
| 02_Plate_Synthetic_Generator | Arabic + Latin OFL fonts in `Data/Plates/Fonts`, render 100 k cells + detector scenes | visual check of 50 random samples |
| 03_Plate_Detector_Training | YOLO11n-pose 150 epochs, AdamW lr 0.002, cosine, no flips, hsv_v 0.5 | test box mAP50 ≥ 0.97, corner error ≤ 3 % |
| 04_Plate_Recognizer_Training | cell CRNN-CTC 60 epochs OneCycle 1e-3, real+synthetic 1:1 then real-only; PARSeq-tiny (digits charset) 30 epochs | val exact-match ≥ 95 % (day) |
| 05_Plate_Pipeline_Evaluation | end-to-end on recorded sequences: exact match day/night/glare, row-agreement rate, latency, fallback rate | targets met on the pilot set |
| 06_Plate_Model_Export | ONNX + TFLite int8 + Core ML, `Model_Card.json`, package + sign | sizes < 15 MB; Android/iOS benchmark < 1.5 s |
| 07_Plate_Station_Fine_Tuning | ≥ 300 corrected samples, 15 epochs lr 2e-4, freeze backbone 3 epochs, promotion rule | `Promotion.json` written |

---

## 3. Model 2 — Face recognition (owner: Abdelrahman)

### Targets (AI-Q2, AI-Q4)
FAR ≤ 0.1 % with FRR ≤ 3 % · FRR gap between demographic groups ≤ 1.5 points · face + liveness on device < 20 MB.

### Most robust architecture
| Part | Choice | Why |
|---|---|---|
| Detection + 5 landmarks | **YuNet** (MIT) — or MediaPipe BlazeFace | tiny, fast, landmarks for alignment, runs on both phones |
| Alignment | similarity transform to the ArcFace 112×112 template | identical everywhere (training, phones, server) |
| Teacher (server) | **IResNet-50 + AdaFace** loss, 512-d | AdaFace scales the margin by image quality → best on low-light / blurry phone selfies (the garage case) |
| Student (device) | **MobileFaceNet** (≈1 M params) trained with AdaFace + **cosine distillation** from the teacher | phone and server embeddings stay compatible |
| Rule | never trained on station faces; 1:1 match inside one tenant only | spec 3.6 |

### Data
| Dataset | Use | Licence |
|---|---|---|
| **WebFace4M** (4 M images / 200 k identities) | main training | research — apply on the official site |
| CASIA-WebFace (0.5 M / 10 k) | first baseline | research |
| **DigiFace-1M** (synthetic) | pose / lighting variety without real people | research |
| LFW, CFP-FP, AgeDB-30, **IJB-C** | evaluation | research |
| Consented in-house set (workers in real garage light, caps, masks, sunglasses) | bias + threshold tuning | written consent |

> **Owner decision required before commercial launch:** research-only licences cover the prototype. For production use either licensed training data or a licensed face-recognition SDK. Record the decision in the model card.

### Notebook steps
| Notebook | Do | Done when |
|---|---|---|
| 01_Face_Dataset_Preparation | folders per identity, drop identities < 5 images, dedupe | stats printed |
| 02_Face_Detection_Alignment | YuNet + alignment → 112×112 dataset | 99 % of images aligned |
| 03_Face_Embedding_Training | IResNet-50 + AdaFace, SGD 0.1, 26 epochs, milestones 12/20/24, AMP, batch 256 | LFW ≥ 99.7 %, CFP-FP ≥ 98 % |
| 04_Face_Distillation_Mobile | MobileFaceNet student, λ_KD = 4 | LFW ≥ 99.4 %, size < 5 MB |
| 05_Face_Verification_Evaluation | threshold at FAR 1e-3; FRR per group | FRR ≤ 3 %, gap ≤ 1.5 pts |
| 06_Face_Model_Export | ONNX (server), TFLite fp16, Core ML | parity test: cosine(phone, server) ≥ 0.99 on 1 k faces |
| 07_Face_Enrollment_Quality_Gates | thresholds shared with apps | gates documented in the model card |

---

## 4. Model 3 — Face liveness / anti-spoofing (owner: Omar)

### Targets (AI-Q3)
APCER ≤ 2 % on printed photo, screen replay and video attacks · BPCER ≤ 5 % · check-in end-to-end < 4 s.

### Most robust architecture (defence in depth)
| Layer | Model | Why |
|---|---|---|
| Active (device) | random 2 prompts (blink / turn left / turn right / smile) with **MediaPipe Face Landmarker** blendshapes + head pose | defeats static photos and most replays; no training |
| Passive (device) | **MiniFASNetV2-SE ×2** (face crop ×2.7 and ×4.0, 80×80) + **Fourier-spectrum auxiliary loss** | learns moiré / halftone / screen-edge cues; < 2 MB total |
| Passive (server) | **DINOv2 ViT-S/14 + LoRA** (r = 8) on one frame | best cross-domain generalisation to unseen phones and attack media |
| Decision | fused `0.4·device + 0.6·server`, threshold at BPCER = 5 %, per-station override in `tenant_ai_models.config` | station lighting differs |

### Data
| Dataset | Size | Role |
|---|---|---|
| **CelebA-Spoof** | 625 k images, 10 k subjects | main training |
| **OULU-NPU** | 4,950 videos, 6 phones | training + protocols |
| **SiW / SiW-Mv2** | masks, makeup, more attack types | training |
| Replay-Attack, MSU-MFSD | small | **cross-dataset test only** |
| **In-house attacks** | target 30 k frames | printed photos, phone + tablet replays, recorded in our garages under the consent protocol |

### Notebook steps
| Notebook | Do | Done when |
|---|---|---|
| 01_Liveness_Dataset_Preparation | one manifest: source, subject, label, attack type, split by subject; MSU + Replay test-only | manifest saved |
| 02_Liveness_Passive_Training | run YuNet once → face boxes; train scale 2.7 and 4.0, 25 epochs, AdamW 1e-3, label smoothing 0.05, λ_FT = 1 | intra-dataset ACER < 3 % |
| 03_Liveness_Server_Vit_Training | DINOv2 ViT-S + LoRA, RandAugment, 10–15 epochs | cross-dataset ACER < 8 % |
| 04_Liveness_Active_Prompts | tune blink / smile / yaw thresholds on recorded clips | genuine pass ≥ 98 %, photo / replay fail |
| 05_Liveness_Evaluation | APCER per attack type, BPCER, ACER; fused score | APCER ≤ 2 %, BPCER ≤ 5 % |
| 06_Liveness_Model_Export | TFLite int8 / Core ML / ONNX (merged LoRA) | sizes ok, latency ok |

---

## 5. Per-station MLOps (owner: Omar, with Abdelrahman)
1. **Collect**: corrected plate scans → `ai_training_samples` (tenant only), images under the tenant prefix, retention 90 days.
2. **Trigger**: plan schedule (Pro quarterly, Enterprise monthly) or owner request from S8; needs ≥ 300 new samples.
3. **Train in isolation**: a container started per job with a token scoped to ONE tenant; it can read only `tenants/<tid>/training/` and write only `tenants/<tid>/models/`; destroyed after the job.
4. **Evaluate**: must beat the station's active version on its held-out test set AND not regress (> 0.5 pt) on the fixed synthetic platform regression set.
5. **Package**: ONNX + TFLite + Core ML, sign, encrypt with a new package key, register as `candidate`.
6. **Promote**: set `active` (previous kept for one-click rollback); apps download on next login.
7. **Monitor**: daily accuracy proxy = 1 − correction rate; alert on a 5-point drop.
Rule (AI-06): station data is never used for base models unless the owner signs an explicit opt-in.

## 6. Privacy & compliance (PRV-01..05)
- Consent forms for workers (face) and for attack-data volunteers before any capture; store the signed consent id with every template / sample.
- No raw face images kept after enrollment; inference logs store confidence and timing only.
- Datasets and weights are git-ignored; store them on the team drive / Kaggle datasets with restricted access.
- Legal review of Kuwait data-privacy duties (CITRA Data Privacy Protection Regulation; biometric processing, retention, cross-border transfer) — owner action with a Kuwaiti lawyer.

## 7. Timeline (AI track)
| Weeks | Abdelrahman (plate + face) | Omar (liveness + MLOps) |
|---|---|---|
| 0–3 | confirm Kuwaiti plate types with MOI rules, pilot capture plan + consent, Open Images, synthetic generator, labelling setup | consent protocol, attack-capture plan, package format + signing key ceremony |
| 3–8 | detector v0, CRNN v0; face baseline (CASIA) | passive v0 (MiniFASNet), active prompt thresholds |
| 8–12 | plate v1 ≥ 90 %, LiteRT export, Android benchmark; WebFace4M training | liveness v1, Core ML conversion of all three models, iOS benchmark |
| 12–19 | pilot field data → plate v1.1 ≥ 95 %; MobileFaceNet distillation; thresholds | ViT-S server model; attack testing; inference service models loaded |
| 19–31 | fine-tune pipeline (notebook 07), bias tests | registry, promotion, rollback, monitoring; S8 metrics |
| 31–37 | field validation at the pilot station | external attack test (pen-test lab) |

## 8. Risks
| Risk | Mitigation |
|---|---|
| Too few real Kuwaiti plates (no public dataset; night, taxi, commercial) | synthetic generator + pilot capture campaign + per-station fine-tune |
| Licence of face datasets for commercial use | decide licensed data / SDK before launch (owner) |
| Domain shift between phones / lighting | per-station thresholds, DINOv2 server model, field data |
| Phone vs server embedding mismatch | distillation + parity test in notebook 06; templates tied to `model_version` and regenerated on change |
| Device too slow | int8 quantisation, GPU delegate / Neural Engine, 720p input, 150 ms sampling |
