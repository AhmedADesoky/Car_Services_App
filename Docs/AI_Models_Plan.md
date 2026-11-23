# AI_Models_Plan — Plate, Face and Liveness models

Source: spec section 11 (AI Models), 3.6 (AI isolation per station), 8.6 (AI quality), 13 (phases).
All training happens in **Jupyter notebooks** under `AI_Models/` (PyTorch). Every model is exported to
**ONNX** (FastAPI server), **LiteRT `.tflite`** (Android) and **Core ML `.mlpackage`** (iOS).

| | Model 1 — Plate recognition | Model 2 — Face recognition | Model 3 — Face liveness |
|---|---|---|---|
| Owner | Android team (lead Abdelrahman Hisham) | Android team (lead Abdelrahman Hisham) | iOS team (lead Omar Mohamed) |
| Job | Find the plate, read Arabic letters + Arabic-Indic digits | Face → 512-d embedding, 1:1 match | Live person vs photo / screen / video / mask |
| Target | 95 % exact match day, 90 % night | FAR 0.1 % at FRR ≤ 3 % | APCER ≤ 2 %, BPCER ≤ 5 % |
| On device | < 15 MB, < 1.5 s | < 10 MB | < 10 MB |
| Station fine-tune | **Yes** (own corrected scans only) | **No** (only templates + threshold) | Threshold per station; optional fine-tune with consent |

---

## Model 1 — License-plate recognition

### Architecture (two stages + voting)
1. **Detector — YOLO11n** (640 px, ≈2.6 M params). Five classes = plate colour band
   (private, taxi, transport, commercial, other), so plate type comes for free.
   * Why: the best small real-time detector, with built-in export to ONNX / TFLite int8 / Core ML.
   * Licence: AGPL-3.0. A closed-source commercial app needs an Ultralytics licence. The fallback with the same pipeline is
     **YOLOX-Tiny (Apache-2.0)**.
2. **Recogniser on device — CRNN-CTC**: MobileNetV3-Small features → 2× BiLSTM(128) → CTC over the charset
   *17 plate letters + ٠-٩ + A-Z + 0-9 + space*. ≈1.5 M params, ≈4 MB int8.
3. **Recogniser on server — PARSeq** (permuted autoregressive ViT, Apache-2.0). It is called only when phone
   confidence < 0.85 (`POST /v1/plates/recognize`) and is more robust on dirty, blurred and angled plates.
4. **Pipeline:** frames every 150 ms → detector → **3 sharpest crops** (Laplacian variance) → recogniser →
   majority vote on the normalised key → confidence = mean × agreement.
5. **Normalisation** (`Common_Utils/Plate_Normalizer.py`): display `ق ص ر ١٤٢٧` ↔ key `QCR1427`. The table is
   agreed with the owner in P0.

### Data (best available)
| Data | Why | Notes |
|---|---|---|
| **EALPR** (Egyptian ALPR, ~2.4 k images with char boxes) | real Egyptian plates | research licence |
| Kaggle Egyptian plate sets | more real variety | check each licence |
| **Open Images v7 — Vehicle registration plate** | detector pre-training at scale | CC-BY 4.0 |
| **Synthetic Egyptian plates (100 k+)** | rare types, night, rain, glare, angles | notebook 02, OFL fonts |
| Station corrected scans | per-station fine-tune only | stay in the tenant's storage prefix |

Split by **plate text** so the same car is never in train and test.

### Notebooks — `AI_Models/Plate_Recognition/`
| Notebook | Output |
|---|---|
| `01_Plate_Dataset_Preparation` | YOLO dataset `plates.yaml`, recognition crops `labels.csv` |
| `02_Plate_Synthetic_Generator` | `Data/Plates/Synthetic` + labels |
| `03_Plate_Detector_Training` | `best.pt`, mAP50 (target ≥ 0.97) |
| `04_Plate_Recognizer_Training` | CRNN weights; PARSeq fine-tune recipe |
| `05_Plate_Pipeline_Evaluation` | exact match day / night, CER, latency, fallback rate |
| `06_Plate_Model_Export` | `Weights/plate/<ver>/` ONNX + tflite + mlpackage + `Model_Card.json` |
| `07_Plate_Station_Fine_Tuning` | per-tenant candidate + `Promotion.json` |

---

## Model 2 — Face recognition

### Architecture
* **Detector + 5 landmarks:** **YuNet** (OpenCV Zoo, MIT, 75 k params). Alternative: MediaPipe BlazeFace.
* **Alignment:** similarity transform to the ArcFace 112×112 template. The same code is used everywhere.
* **Teacher (server): IResNet-50 + AdaFace loss** → 512-d. AdaFace adapts the margin to image quality, which makes it the most
  robust choice for low-light, blurry phone selfies, i.e. exactly the garage check-in case.
* **Student (device): MobileFaceNet** (≈1 M params). It is trained with AdaFace **plus cosine distillation** to the teacher,
  so phone and server embeddings are compatible (the server re-does the 1:1 decision).
* **Never trained on station faces.** A station stores only its workers' templates, encrypted with the tenant key, plus its threshold.

### Data
| Data | Use | Licence |
|---|---|---|
| **WebFace4M** (4 M imgs / 200 k ids) | main training | research — apply |
| CASIA-WebFace (0.5 M / 10 k) | first baseline | research |
| **DigiFace-1M** (synthetic) | pose / lighting variety | research |
| LFW, CFP-FP, AgeDB-30, **IJB-C** | evaluation | research |
| Consented in-house set (Egyptian workers, garage light, caps / masks) | bias + threshold checks | written consent |

⚠️ Before a **commercial launch** the owner must choose: licensed training data, or a licensed face SDK.

### Enrollment and verification rules (notebook 07, same thresholds in the apps)
One face · eye distance > 80 px · sharp · exposure OK · yaw / pitch < 20° · liveness passed on each frame →
average **3–5** embeddings → template. Verification: on-device embedding + liveness give instant feedback;
the **server decides** 1:1 against that worker's templates only.

### Notebooks — `AI_Models/Face_Recognition/`
`01_Face_Dataset_Preparation` · `02_Face_Detection_Alignment` · `03_Face_Embedding_Training` ·
`04_Face_Distillation_Mobile` · `05_Face_Verification_Evaluation` · `06_Face_Model_Export` ·
`07_Face_Enrollment_Quality_Gates`

---

## Model 3 — Face liveness (anti-spoofing)

### Architecture (hybrid, defence in depth)
1. **Active check (device):** 2 random prompts from {blink, turn left, turn right, smile}, verified with
   **MediaPipe Face Landmarker** blendshapes + head pose. No training; thresholds are tuned in notebook 04.
2. **Passive check (device):** **multi-scale MiniFASNetV2-SE** ensemble on face crops ×2.7 and ×4.0 (80×80),
   with an **auxiliary Fourier-spectrum loss** that learns moiré / halftone patterns of screens and prints.
   ≈0.45 M params each, < 2 MB total.
3. **Passive check (server):** **DINOv2 ViT-S/14 fine-tuned with LoRA** on one frame per check-in. It gives the best
   cross-domain generalisation to unseen phones and attack media.
4. **Decision:** fused score `0.4·device + 0.6·server`. The threshold is set at BPCER = 5 % and stored per station in
   `tenant_ai_models.config`.

### Data
| Data | Use |
|---|---|
| **CelebA-Spoof** (625 k imgs, 10 k subjects) | main training |
| **OULU-NPU** (6 phones) | training + protocol tests |
| **SiW / SiW-Mv2** | masks, makeup, more attacks |
| Replay-Attack, MSU-MFSD | **cross-dataset test only** |
| In-house attacks (printed photo, phone/tablet replay in our garages, with consent) | fine-tune + final test |

### Notebooks — `AI_Models/Face_Liveness/`
`01_Liveness_Dataset_Preparation` · `02_Liveness_Passive_Training` · `03_Liveness_Server_Vit_Training` ·
`04_Liveness_Active_Prompts` · `05_Liveness_Evaluation` (APCER / BPCER / ACER, ISO/IEC 30107-3) ·
`06_Liveness_Model_Export`

---

## Per-station MLOps (spec 11.3)
1. **Collect:** corrected plate scans → `ai_training_samples` (tenant only), split 80/10/10.
2. **Trigger:** by plan (quarterly / monthly) or on owner request; needs ≥ 300 new samples.
3. **Train:** an isolated job with a token for ONE tenant. It reads and writes only that tenant's prefix, starts from the base model, 1–2 h on GPU.
4. **Evaluate:** the candidate must beat the station's active version AND not regress on the platform synthetic set.
5. **Package:** ONNX + LiteRT + Core ML, signed and encrypted with the tenant key.
6. **Promote / rollback:** `tenant_ai_models.status = active`; the previous version is kept for one-click rollback.
7. **Monitor:** accuracy proxy = 1 − correction rate; alert when it drops 5 points.

## Serving — `AI_Models/Inference_Service/` (phase P4+)
FastAPI + ONNX Runtime: `Inference_Main.py` (endpoints `/plate/recognize`, `/face/verify`, `/liveness/check`)
and `Model_Router.py`, which loads `(tenant_id, kind) → active version`. Logs keep only confidence and latency, never images.

## Timeline (AI track, parallel to the apps)
| Weeks | Plate + face (Abdelrahman) | Liveness + registry (Omar) |
|---|---|---|
| 0–3 | dataset plan, licences, synthetic generator, labelling | attack-data protocol, consent forms, registry design |
| 3–8 | detector + CRNN v0; face baseline | passive liveness v0; active prompts |
| 8–12 | plate v1 ≥ 90 %; LiteRT; Android benchmark | liveness v1; Core ML conversion of all 3 |
| 12–19 | pilot field data → plate v1.1 ≥ 95 %; face thresholds | attack testing; server inference; per-tenant routing |
| 19–31 | fine-tune pipeline; face bias tests | registry, promotion, rollback, monitoring; AI page in apps |
