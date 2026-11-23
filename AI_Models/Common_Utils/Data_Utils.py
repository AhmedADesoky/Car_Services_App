"""Dataset helpers shared by all three models."""
from __future__ import annotations

import hashlib
import random
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def seed_everything(seed: int = 42) -> None:
    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def list_images(folder: Path) -> list[Path]:
    return sorted(p for p in Path(folder).rglob("*") if p.suffix.lower() in IMAGE_EXT)


def stable_split(key: str, ratios: Sequence[float] = (0.8, 0.1, 0.1)) -> str:
    """Deterministic train/val/test split from a key (e.g. a plate text or a subject id).

    Splitting by IDENTITY (same plate / same person never in two splits) avoids leaking
    test data into training - the most common reason models look better than they are.
    """
    bucket = int(hashlib.sha1(key.encode("utf-8")).hexdigest(), 16) % 10_000 / 10_000
    train, val, _ = ratios
    if bucket < train:
        return "train"
    if bucket < train + val:
        return "val"
    return "test"


def variance_of_laplacian(gray: np.ndarray) -> float:
    """Sharpness score; higher = sharper. Used to pick the best plate crops and face frames."""
    import cv2

    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def chunked(items: Iterable, size: int):
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch
