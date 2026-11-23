"""Evaluation metrics for the three models (targets come from spec section 11)."""
from __future__ import annotations

import numpy as np

# ---------------------------------------------------------------- plates
def character_error_rate(predictions: list[str], targets: list[str]) -> float:
    import editdistance

    edits = sum(editdistance.eval(p, t) for p, t in zip(predictions, targets))
    return edits / max(1, sum(len(t) for t in targets))


def exact_match(predictions: list[str], targets: list[str]) -> float:
    return float(np.mean([p == t for p, t in zip(predictions, targets)])) if targets else 0.0


# ---------------------------------------------------------------- face verification
def roc_points(genuine: np.ndarray, impostor: np.ndarray, num: int = 2000):
    """Return thresholds, FAR and FRR for cosine-similarity scores."""
    thresholds = np.linspace(-1, 1, num)
    far = np.array([(impostor >= t).mean() for t in thresholds])
    frr = np.array([(genuine < t).mean() for t in thresholds])
    return thresholds, far, frr


def threshold_at_far(genuine: np.ndarray, impostor: np.ndarray, target_far: float = 1e-3):
    """Lowest threshold whose FAR <= target. Spec target: FAR 0.1% with FRR <= 3%."""
    thresholds, far, frr = roc_points(genuine, impostor, num=20_000)
    ok = np.where(far <= target_far)[0]
    i = ok[0] if len(ok) else len(thresholds) - 1
    return float(thresholds[i]), float(far[i]), float(frr[i])


# ---------------------------------------------------------------- liveness (ISO/IEC 30107-3)
def apcer_bpcer(scores: np.ndarray, is_live: np.ndarray, attack_type: np.ndarray, threshold: float):
    """score = probability of LIVE. APCER is reported per attack type (worst case counts)."""
    accept = scores >= threshold
    bpcer = float((~accept[is_live == 1]).mean()) if (is_live == 1).any() else 0.0
    per_attack = {}
    for kind in np.unique(attack_type[is_live == 0]):
        mask = (is_live == 0) & (attack_type == kind)
        per_attack[str(kind)] = float(accept[mask].mean())
    apcer = max(per_attack.values()) if per_attack else 0.0
    return {"APCER": apcer, "BPCER": bpcer, "ACER": (apcer + bpcer) / 2, "APCER_per_attack": per_attack}


def threshold_at_bpcer(scores: np.ndarray, is_live: np.ndarray, target_bpcer: float = 0.05) -> float:
    """Threshold that rejects at most target_bpcer of genuine users (spec: BPCER 5%)."""
    live_scores = np.sort(scores[is_live == 1])
    index = int(np.floor(target_bpcer * len(live_scores)))
    return float(live_scores[min(index, len(live_scores) - 1)])
