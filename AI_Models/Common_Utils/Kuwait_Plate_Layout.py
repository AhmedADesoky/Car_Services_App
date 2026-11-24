"""Fixed layout of a Kuwaiti private plate, shared by the synthetic generator, training and the live pipeline.

After the detector finds the 4 plate corners, the plate is warped to a canonical rectangle; the cells then sit
at fixed positions, so the recogniser only ever reads short single-row digit strips:

    +--------+------+-------------------+
    | الكويت |  ١٢  |     ٣٤٥٦٧         |   <- top row: Arabic-Indic digits
    | KUWAIT |  12  |     34567         |   <- bottom row: English digits
    +--------+------+-------------------+
      strip    code        number

Fractions are a starting proposal - measure real plates in Phase 0 and update this one file.
"""
from __future__ import annotations

from typing import Dict, Sequence, Tuple

import numpy as np

CANONICAL_W, CANONICAL_H = 520, 120

# (x0, y0, x1, y1) as fractions of the canonical plate
CELLS: Dict[str, Tuple[float, float, float, float]] = {
    "code_ar":   (0.19, 0.06, 0.36, 0.57),
    "code_lat":  (0.19, 0.57, 0.36, 0.95),
    "num_ar":    (0.38, 0.06, 0.98, 0.57),
    "num_lat":   (0.38, 0.57, 0.98, 0.95),
}
STRIP = (0.0, 0.0, 0.18, 1.0)   # "الكويت / KUWAIT" + flag colours (not read)
CELL_H, CELL_W = 32, 100        # recogniser input size per cell (gray)


def warp(image: np.ndarray, corners: Sequence[Tuple[float, float]]) -> np.ndarray:
    """corners: top-left, top-right, bottom-right, bottom-left in pixels -> canonical plate (BGR)."""
    import cv2
    src = np.array(corners, dtype=np.float32)
    dst = np.array([[0, 0], [CANONICAL_W - 1, 0], [CANONICAL_W - 1, CANONICAL_H - 1], [0, CANONICAL_H - 1]], dtype=np.float32)
    return cv2.warpPerspective(image, cv2.getPerspectiveTransform(src, dst), (CANONICAL_W, CANONICAL_H))


def split_cells(plate: np.ndarray) -> Dict[str, np.ndarray]:
    """Canonical plate -> the 4 cell crops (code/number x Arabic/English)."""
    h, w = plate.shape[:2]
    out = {}
    for name, (x0, y0, x1, y1) in CELLS.items():
        out[name] = plate[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    return out


def cell_box_px(name: str, w: int = CANONICAL_W, h: int = CANONICAL_H) -> Tuple[int, int, int, int]:
    x0, y0, x1, y1 = CELLS[name]
    return int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)
