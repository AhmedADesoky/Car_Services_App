"""Single place for folder locations so every notebook works on Kaggle, Colab and locally."""
from __future__ import annotations

import os
from pathlib import Path


def _detect_root() -> Path:
    if os.environ.get("CAR_AI_ROOT"):
        return Path(os.environ["CAR_AI_ROOT"])
    if Path("/kaggle/working").exists():
        return Path("/kaggle/working/AI_Models")
    if Path("/content").exists():           # Google Colab (mount Drive to keep results)
        drive = Path("/content/drive/MyDrive/Car_Services_AI")
        return drive if drive.parent.exists() else Path("/content/AI_Models")
    return Path(__file__).resolve().parents[1]


ROOT = _detect_root()
DATA = ROOT / "Data"          # raw + prepared datasets (git-ignored)
RUNS = ROOT / "Runs"          # training logs / checkpoints (git-ignored)
WEIGHTS = ROOT / "Weights"    # final exported models (git-ignored)

for folder in (DATA, RUNS, WEIGHTS):
    folder.mkdir(parents=True, exist_ok=True)


def model_dir(kind: str, version: str) -> Path:
    """Weights/<kind>/<version>/ - e.g. Weights/plate/1.0.0/"""
    path = WEIGHTS / kind / version
    path.mkdir(parents=True, exist_ok=True)
    return path
