# Inference_Service (phase P4+)

FastAPI + ONNX Runtime service used by the backend for:
- `POST /plate/recognize`: server fallback (PARSeq) when the phone's confidence is below 0.85
- `POST /face/verify`: 1:1 embedding match against one worker's templates, inside one tenant
- `POST /liveness/check`: server ViT liveness on one frame

Planned files: `Inference_Main.py` (FastAPI app) and `Model_Router.py`, which maps `(tenant_id, kind)` to the
station's active model version from `tenant_ai_models`.

Rules from spec section 3.6:
- Inference logs keep only the confidence and the latency, never the images.
- Frames are deleted after the decision.
