"""Export one PyTorch model to the three runtimes used by the platform (spec section 11):
ONNX (FastAPI server), LiteRT .tflite (Android) and Core ML .mlpackage (iOS)."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import torch


def export_onnx(model: torch.nn.Module, sample: torch.Tensor, path: Path, dynamic_batch: bool = True) -> Path:
    model.eval()
    axes = {"input": {0: "batch"}, "output": {0: "batch"}} if dynamic_batch else None
    torch.onnx.export(model, sample, str(path), input_names=["input"], output_names=["output"],
                      dynamic_axes=axes, opset_version=17)
    try:
        import onnx
        from onnxsim import simplify

        simplified, ok = simplify(onnx.load(str(path)))
        if ok:
            onnx.save(simplified, str(path))
    except ImportError:
        pass
    return path


def export_litert(model: torch.nn.Module, sample: torch.Tensor, path: Path, int8: bool = True) -> Path:
    """PyTorch -> LiteRT via ai-edge-torch. int8 dynamic-range quantisation keeps models small."""
    import ai_edge_torch

    model.eval()
    kwargs = {}
    if int8:
        # Dynamic-range int8 weights through the TFLite converter flags (needs tensorflow installed).
        import tensorflow as tf

        kwargs["_ai_edge_converter_flags"] = {"optimizations": [tf.lite.Optimize.DEFAULT]}
    edge_model = ai_edge_torch.convert(model, (sample,), **kwargs)
    edge_model.export(str(path))
    return path


def export_coreml(model: torch.nn.Module, sample: torch.Tensor, path: Path) -> Path:
    import coremltools as ct

    model.eval()
    traced = torch.jit.trace(model, sample)
    mlmodel = ct.convert(traced, inputs=[ct.TensorType(name="input", shape=sample.shape)],
                         convert_to="mlprogram", compute_precision=ct.precision.FLOAT16)
    mlmodel.save(str(path))
    return path


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    target = Path(path)
    files = sorted(target.rglob("*")) if target.is_dir() else [target]
    for file in files:
        if file.is_file():
            digest.update(file.read_bytes())
    return digest.hexdigest()


def write_model_card(folder: Path, *, kind: str, version: str, metrics: dict, data_sources: list[str],
                     input_spec: dict, notes: str = "") -> Path:
    """Model card stored with every package (spec: ai_base_models.training_data_card)."""
    card = {
        "kind": kind,
        "version": version,
        "metrics": metrics,
        "training_data": data_sources,
        "contains_station_data": False,
        "input": input_spec,
        "files": {p.name: sha256_of(p) for p in Path(folder).iterdir() if p.name != "Model_Card.json"},
        "notes": notes,
    }
    out = Path(folder) / "Model_Card.json"
    out.write_text(json.dumps(card, indent=2, ensure_ascii=False), encoding="utf-8")
    return out
