"""Builds Plate_Full_Pipeline_Kaggle.ipynb from Plate_Full_Pipeline_Kaggle.py (percent format: "# %%" cells).

Edit the .py file (easy to diff and test as a plain script), then run:
    python Build_Kaggle_Notebook.py
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "Plate_Full_Pipeline_Kaggle.py"
TARGET = HERE / "Plate_Full_Pipeline_Kaggle.ipynb"


def build() -> None:
    cells, kind, buffer = [], None, []

    def flush():
        if kind is None:
            return
        text = "\n".join(buffer).strip("\n")
        if kind == "markdown":
            text = "\n".join(line[2:] if line.startswith("# ") else line.lstrip("#") for line in text.splitlines())
        if not text.strip():
            return
        source = [line + "\n" for line in text.splitlines()]
        source[-1] = source[-1].rstrip("\n")
        cell = {"cell_type": kind, "metadata": {}, "source": source}
        if kind == "code":
            cell.update(execution_count=None, outputs=[])
        cells.append(cell)

    for line in SOURCE.read_text(encoding="utf-8").splitlines():
        if line.startswith("# %%"):
            flush()
            kind, buffer = ("markdown" if "[markdown]" in line else "code"), []
        else:
            buffer.append(line)
    flush()

    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python"},
            "accelerator": "GPU",
            "kaggle": {"accelerator": "gpu", "isInternetEnabled": True, "isGpuEnabled": True},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    TARGET.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {TARGET.name}: {len(cells)} cells")


if __name__ == "__main__":
    build()
