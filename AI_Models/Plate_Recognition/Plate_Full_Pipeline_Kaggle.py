# %% [markdown]
# # Kuwaiti Plate Recognition · Full Pipeline (Kaggle, one notebook)
#
# One notebook that does everything the six plate notebooks do, end to end:
#
# | Step | What happens | Was notebook |
# |---|---|---|
# | 1 | Install packages, settings, GPU check | – |
# | 2 | Download data: OFL fonts + real car photos with annotated plates (Kaggle) | 01 |
# | 3 | Generate synthetic **Kuwaiti** plates (code + number, Arabic + English digits) | 02 |
# | 4 | Build the detector dataset: plates pasted over the real plates in real photos + synthetic scenes, **box + 4 corners** | 01 / 02 |
# | 5 | Train the detector **YOLO11n-pose** and evaluate | 03 |
# | 6 | Build the 4-cell dataset and train the **CRNN-CTC** cell reader | 01 / 04 |
# | 7 | End-to-end evaluation: detect → corners → warp → 4 cells → read → **Arabic/English cross-check** | 05 |
# | 8 | Export ONNX (+ optional TFLite), parity check, model card, one zip to download | 06 |
#
# **How to run on Kaggle**
# 1. *Create → New Notebook → File → Import Notebook* → upload this `.ipynb`.
# 2. Right panel → *Session options*: **Accelerator = GPU T4 x2** (or P100) and **Internet = On** (needed for pip, fonts and data).
# 3. Optional: attach your own labelled Kuwaiti photos (*Add Input*) and set `KUWAIT_REAL_DIR` in the settings cell.
# 4. *Run All*. `RUN_MODE = "quick"` takes about 45–60 min on a T4; `"full"` takes several hours (Kaggle allows 12 h).
# 5. Download `plate_package_<version>.zip` from the *Output* tab.
#
# Everything is written to `/kaggle/working`. No station data is used: this is the **base** model.

# %%
# ===================================================================== 1. Settings
import os
RUN_MODE = os.environ.get("PLATE_RUN_MODE", "quick")   # "quick" | "full" | "smoke" (tiny CPU test)

# Optional: your own labelled Kuwaiti photos attached as a Kaggle dataset, e.g. "/kaggle/input/kuwait-plates".
# Expected layout: images/*.jpg + labels/*.txt (YOLO-pose: cls cx cy w h x1 y1 v1 ... x4 y4 v4, corners TL TR BR BL)
#                  + index.csv with columns image,key   (key like "12-34567")
KUWAIT_REAL_DIR = None

MODEL_VERSION = "1.0.0-kw"
CFG = {
    "smoke": dict(plates=120, scenes=60, det_epochs=1, det_imgsz=320, det_batch=8, rec_epochs=2, rec_batch=64, eval_images=20, export_tflite=False),
    "quick": dict(plates=25000, scenes=2400, det_epochs=25, det_imgsz=640, det_batch=32, rec_epochs=15, rec_batch=256, eval_images=300, export_tflite=False),
    "full":  dict(plates=150000, scenes=20000, det_epochs=120, det_imgsz=640, det_batch=32, rec_epochs=30, rec_batch=512, eval_images=2000, export_tflite=True),
}[RUN_MODE]
import json as _json
CFG.update(_json.loads(os.environ.get("PLATE_CFG_OVERRIDES", "{}")))   # e.g. '{"rec_epochs": 20}'
print("RUN_MODE:", RUN_MODE, CFG)

# %%
# ===================================================================== 1b. Install packages (Kaggle has most of them)
import importlib, subprocess, sys

def ensure(module, package=None):
    try:
        importlib.import_module(module)
    except ImportError:
        print("installing", package or module)
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", package or module], check=True)

for module, package in [("cv2", "opencv-python-headless"), ("ultralytics", "ultralytics"), ("onnx", "onnx"),
                        ("onnxruntime", "onnxruntime"), ("arabic_reshaper", "arabic-reshaper"), ("bidi", "python-bidi"),
                        ("kagglehub", "kagglehub"), ("fontTools", "fonttools")]:
    ensure(module, package)

# %%
# ===================================================================== 1c. Imports, paths, seed, device
import json, math, random, re, shutil, time, zipfile, glob
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torchvision
from PIL import Image, ImageDraw, ImageFont, features as pil_features

ON_KAGGLE = Path("/kaggle/working").exists()
WORK = Path("/kaggle/working") if ON_KAGGLE else Path.cwd() / "Kaggle_Work"
DATA = WORK / "data"
RUNS = WORK / "runs"
PKG = WORK / f"plate_package_{MODEL_VERSION}"
for d in (DATA, RUNS, PKG):
    d.mkdir(parents=True, exist_ok=True)

SEED = 42
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print("Work dir:", WORK, "| device:", DEVICE, torch.cuda.get_device_name(0) if DEVICE == "cuda" else "")

# %% [markdown]
# ## Kuwaiti plate rules and layout
# A Kuwaiti plate carries a **code** (1–2 digits) and a **number** (up to 5 digits), each printed twice:
# Arabic-Indic digits on the top row, English digits on the bottom row. No letters.
# After the detector finds the 4 corners, the plate is warped to a canonical 520×120 rectangle and cut into 4 fixed cells.
# (Same code as `Common_Utils/Plate_Normalizer.py` and `Common_Utils/Kuwait_Plate_Layout.py`.)

# %%
# ===================================================================== 2. Plate rules (normalizer) + layout
ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
EASTERN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
LATIN_DIGITS = "0123456789"
CHARSET = ARABIC_INDIC_DIGITS + LATIN_DIGITS

def to_western_digits(text):
    table = {ord(a): str(i) for i, a in enumerate(ARABIC_INDIC_DIGITS)}
    table.update({ord(a): str(i) for i, a in enumerate(EASTERN_DIGITS)})
    return text.translate(table)

def to_arabic_digits(text):
    return "".join(ARABIC_INDIC_DIGITS[int(c)] if c.isdigit() else c for c in to_western_digits(text))

def is_valid(code, number):
    return (re.fullmatch(r"\d{1,2}", code or "") is not None and 1 <= int(code) <= 99
            and re.fullmatch(r"\d{1,5}", number or "") is not None and int(number) > 0)

def parse_plate(text):
    groups = re.findall(r"\d+", to_western_digits(text))
    if len(groups) == 2:
        a, b = groups
        code, number = (a, b) if len(a) <= len(b) else (b, a)
    elif len(groups) == 1 and len(groups[0]) > 5:
        code, number = groups[0][:-5], groups[0][-5:]
    else:
        return None
    return (code.lstrip("0") or "0", number) if is_valid(code, number) else None

def normalize(text):
    p = parse_plate(text)
    return f"{p[0]}-{p[1]}" if p else ""

def cross_check(arabic_read, latin_read, arabic_conf, latin_conf):
    """Two printed rows of one cell -> (value, confidence, agreed)."""
    a, l = to_western_digits(arabic_read).strip(), latin_read.strip()
    if a and a == l:
        return l, min(1.0, 1 - (1 - arabic_conf) * (1 - latin_conf) * 4), True
    best, conf = (a, arabic_conf) if arabic_conf >= latin_conf else (l, latin_conf)
    return best, conf * 0.6, False

assert normalize("12 34567") == normalize("١٢ ٣٤٥٦٧") == normalize("34567/12") == "12-34567"

CANONICAL_W, CANONICAL_H = 520, 120
CELLS = {
    "code_ar":  (0.19, 0.06, 0.36, 0.57),
    "code_lat": (0.19, 0.57, 0.36, 0.95),
    "num_ar":   (0.38, 0.06, 0.98, 0.57),
    "num_lat":  (0.38, 0.57, 0.98, 0.95),
}
CELL_NAMES = list(CELLS)
CELL_H, CELL_W = 32, 160    # cells keep their shape at 32 px high, then are padded to 160 px wide

def cell_box_px(name, w=CANONICAL_W, h=CANONICAL_H):
    x0, y0, x1, y1 = CELLS[name]
    return int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)

def warp_plate(image, corners):
    """corners TL, TR, BR, BL (pixels) -> canonical plate."""
    src = np.array(corners, dtype=np.float32)
    dst = np.array([[0, 0], [CANONICAL_W - 1, 0], [CANONICAL_W - 1, CANONICAL_H - 1], [0, CANONICAL_H - 1]], dtype=np.float32)
    return cv2.warpPerspective(image, cv2.getPerspectiveTransform(src, dst), (CANONICAL_W, CANONICAL_H))

def split_cells(plate):
    out = {}
    for name in CELL_NAMES:
        x0, y0, x1, y1 = cell_box_px(name, plate.shape[1], plate.shape[0])
        out[name] = plate[y0:y1, x0:x1]
    return out

def cell_tensor_input(cell_bgr_or_gray):
    """Gray, 32 px high with the ORIGINAL aspect ratio kept (digits are never stretched), left-aligned and
    padded to CELL_W with the cell's own background tone. Same function in training, evaluation and the apps."""
    g = cell_bgr_or_gray if cell_bgr_or_gray.ndim == 2 else cv2.cvtColor(cell_bgr_or_gray, cv2.COLOR_BGR2GRAY)
    h, w = g.shape[:2]
    new_w = int(min(CELL_W, max(1, round(w * CELL_H / max(h, 1)))))
    resized = cv2.resize(g, (new_w, CELL_H), interpolation=cv2.INTER_AREA)
    out = np.full((CELL_H, CELL_W), int(np.median(resized)), np.uint8)
    out[:, :new_w] = resized
    return out

print("rules + layout ready")

# %% [markdown]
# ## 2. Download data
# * **Fonts** (SIL Open Font License) from the official Google Fonts repository: an Arabic font for the Arabic-Indic
#   digits and the "الكويت" strip, and a bold sans font for the English digits. Falls back to fonts already on the machine.
# * **Real car photos with annotated plates**: Kaggle dataset `andrewmvd/car-plate-detection` (433 photos, Pascal-VOC boxes),
#   downloaded with `kagglehub`. We paste Kuwaiti plates **over the real plates**, so the detector learns real cars,
#   real light and real backgrounds with exact corner labels. Verify the dataset licence on its Kaggle page.
# * No public Kuwaiti plate dataset of useful size is known: attach your own pilot-station photos with `KUWAIT_REAL_DIR`.

# %%
# ===================================================================== 2a. Fonts
import urllib.request
from fontTools.ttLib import TTFont

FONT_DIR = DATA / "fonts"
FONT_DIR.mkdir(parents=True, exist_ok=True)
FONT_URLS = {
    "NotoKufiArabic.ttf": "https://github.com/google/fonts/raw/main/ofl/notokufiarabic/NotoKufiArabic%5Bwght%5D.ttf",
    "NotoNaskhArabic.ttf": "https://github.com/google/fonts/raw/main/ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf",
    "Roboto.ttf": "https://github.com/google/fonts/raw/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf",
    "NotoSans.ttf": "https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf",
}
for name, url in FONT_URLS.items():
    target = FONT_DIR / name
    if target.exists() and target.stat().st_size > 10_000:
        continue
    try:
        urllib.request.urlretrieve(url, target)
        print("downloaded", name, target.stat().st_size // 1024, "KB")
    except Exception as error:
        print("could not download", name, "-", error)

def font_covers(path, chars):
    try:
        cmap = TTFont(str(path), fontNumber=0, lazy=True).getBestCmap() or {}
        return all(ord(c) in cmap for c in chars)
    except Exception:
        return False

# Plain, plate-like fonts only: the downloaded ones first, then well-known system fonts as a fallback
# (decorative fonts would teach the reader shapes that never appear on a plate).
SYSTEM_OK = re.compile(r"^(DejaVuSans(-Bold)?|DejaVuSansCondensed(-Bold)?|LiberationSans-(Regular|Bold)|NotoSans(Arabic)?-(Regular|Bold)|arial|arialbd)\.ttf$", re.I)
system = [Path(p) for p in glob.glob("/usr/share/fonts/**/*.ttf", recursive=True) + glob.glob("C:/Windows/Fonts/*.ttf")]
candidates = sorted(FONT_DIR.glob("*.ttf")) + sorted(p for p in system if SYSTEM_OK.match(p.name))
ARABIC_FONTS = [p for p in candidates if font_covers(p, "٠١٢٣٤٥٦٧٨٩الكويت")][:4]
LATIN_FONTS = [p for p in candidates if font_covers(p, "0123456789KUWAIT") and "Arabic" not in p.name][:4]
assert ARABIC_FONTS, "No font with Arabic-Indic digits found: turn Internet ON in the Kaggle session options."
LATIN_FONTS = LATIN_FONTS or ARABIC_FONTS
print("Arabic fonts:", [p.name for p in ARABIC_FONTS])
print("Latin fonts :", [p.name for p in LATIN_FONTS])

# %%
# ===================================================================== 2b. Real car photos with plate boxes
import kagglehub

REAL_PHOTOS = []   # list of (image_path, [ (x1, y1, x2, y2), ... ])
try:
    car_dir = Path(kagglehub.dataset_download("andrewmvd/car-plate-detection"))
    for xml_file in sorted(car_dir.rglob("*.xml")):
        root = ET.parse(xml_file).getroot()
        image_name = root.findtext("filename")
        image_path = next((p for p in car_dir.rglob(image_name)), None) if image_name else None
        boxes = []
        for obj in root.iter("object"):
            b = obj.find("bndbox")
            boxes.append(tuple(int(float(b.findtext(k))) for k in ("xmin", "ymin", "xmax", "ymax")))
        if image_path and boxes:
            REAL_PHOTOS.append((image_path, boxes))
    print("real car photos with plates:", len(REAL_PHOTOS))
except Exception as error:
    print("Real photos not available (Internet off or no Kaggle access) - using generated backgrounds only.", error)

# %% [markdown]
# ## 3. Synthetic Kuwaiti plates
# Canonical layout: left strip "الكويت / KUWAIT" with the flag colours, then the code and the number, each printed in
# Arabic-Indic digits (top) and English digits (bottom). Plate colours per type are **placeholders** – confirm the
# current plate types and colours against Kuwait MOI rules before the real launch.

# %%
# ===================================================================== 3. Plate renderer + augmentations
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    def shape_ar(text):   # correct Arabic letter joining when Pillow has no RAQM
        return text if pil_features.check("raqm") else get_display(arabic_reshaper.reshape(text))
except Exception:
    def shape_ar(text):
        return text

STYLES = {   # plate type -> (background RGB, ink RGB)   PLACEHOLDERS, confirm with MOI rules
    "private": ((248, 248, 246), (15, 15, 15)),
    "taxi": ((245, 196, 48), (15, 15, 15)),
    "commercial_transport": ((225, 232, 240), (20, 40, 110)),
    "government": ((240, 240, 240), (150, 20, 20)),
    "other": ((230, 230, 230), (40, 40, 40)),
}
KINDS = list(STYLES)
KIND_WEIGHTS = [70, 10, 10, 5, 5]
_font_cache = {}

def load_font(path, size):
    key = (str(path), size)
    if key not in _font_cache:
        font = ImageFont.truetype(str(path), size)
        try:
            font.set_variation_by_name("Bold")
        except Exception:
            pass
        _font_cache[key] = font
    return _font_cache[key]

def draw_fitted(draw, box, text, font_path, ink):
    x0, y0, x1, y1 = box
    size = int((y1 - y0) * 1.05)
    while size > 8:
        font = load_font(font_path, size)
        l, t, r, b = draw.textbbox((0, 0), text, font=font)
        if r - l <= (x1 - x0) * 0.92 and b - t <= (y1 - y0) * 0.88:
            break
        size -= 2
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    draw.text((x0 + (x1 - x0 - (r - l)) / 2 - l, y0 + (y1 - y0 - (b - t)) / 2 - t), text, font=font, fill=ink)

def random_plate_text():
    code = str(random.choices(range(1, 100), weights=[4 if c <= 20 else 1 for c in range(1, 100)])[0])
    number = str(random.randint(1, 99999)) if random.random() < 0.88 else str(random.randint(1, 999))
    return code, number

def render_plate(code, number, kind):
    """Canonical Kuwaiti plate as an RGB uint8 array (CANONICAL_H x CANONICAL_W)."""
    bg, ink = STYLES[kind]
    w, h = CANONICAL_W, CANONICAL_H
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    arabic, latin = random.choice(ARABIC_FONTS), random.choice(LATIN_FONTS)
    strip_w = int(0.18 * w)
    d.rectangle([0, 0, strip_w, h], fill=(238, 243, 248))
    draw_fitted(d, (6, 10, strip_w - 6, 50), shape_ar("الكويت"), arabic, ink)
    draw_fitted(d, (6, 54, strip_w - 6, 82), "KUWAIT", latin, ink)
    for k, colour in enumerate([(0, 122, 61), (255, 255, 255), (206, 17, 38)]):
        d.rectangle([10 + k * (strip_w - 26) // 3, 92, 10 + (k + 1) * (strip_w - 26) // 3, 99], fill=colour)
    d.rectangle([strip_w - 16, 92, strip_w - 10, 99], fill=(0, 0, 0))
    draw_fitted(d, cell_box_px("code_ar"), to_arabic_digits(code), arabic, ink)
    draw_fitted(d, cell_box_px("code_lat"), code, latin, ink)
    draw_fitted(d, cell_box_px("num_ar"), to_arabic_digits(number), arabic, ink)
    draw_fitted(d, cell_box_px("num_lat"), number, latin, ink)
    d.line([(int(0.37 * w), 8), (int(0.37 * w), h - 8)], fill=ink, width=3)
    d.rectangle([1, 1, w - 2, h - 2], outline=ink, width=4)
    return np.array(img)

# ---- augmentations (plain OpenCV/numpy, no version-sensitive library)
def aug_light(img):
    img = img.astype(np.float32)
    if random.random() < 0.6:                                     # night / dusk / summer glare
        gamma = random.uniform(0.5, 1.9)
        img = 255.0 * (img / 255.0) ** gamma
    if random.random() < 0.6:
        img = img * random.uniform(0.6, 1.3) + random.uniform(-35, 35)
    if random.random() < 0.15:                                    # glare blob
        h, w = img.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]
        cx, cy, r = random.uniform(0, w), random.uniform(0, h), random.uniform(0.15, 0.5) * max(h, w)
        blob = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)) * random.uniform(80, 200)
        img += blob[..., None] if img.ndim == 3 else blob
    return np.clip(img, 0, 255).astype(np.uint8)

def aug_blur_noise(img):
    if random.random() < 0.35:
        k = random.choice([3, 5, 7])
        kernel = np.zeros((k, k), np.float32)
        kernel[k // 2, :] = 1.0 / k
        rot = cv2.getRotationMatrix2D((k / 2 - 0.5, k / 2 - 0.5), random.uniform(0, 180), 1)
        img = cv2.filter2D(img, -1, cv2.warpAffine(kernel, rot, (k, k)))
    elif random.random() < 0.3:
        img = cv2.GaussianBlur(img, (3, 3), random.uniform(0.3, 1.2))
    if random.random() < 0.4:
        img = np.clip(img.astype(np.float32) + np.random.normal(0, random.uniform(3, 12), img.shape), 0, 255).astype(np.uint8)
    if random.random() < 0.15:                                    # rain streaks
        h, w = img.shape[:2]
        for _ in range(random.randint(20, 80)):
            x, y = random.randint(0, w), random.randint(0, h)
            cv2.line(img, (x, y), (x + random.randint(-3, 3), y + random.randint(6, 18)), (200, 200, 200), 1)
    if random.random() < 0.15:                                    # dirt spots
        h, w = img.shape[:2]
        for _ in range(random.randint(2, 8)):
            cv2.circle(img, (random.randint(0, w), random.randint(0, h)), random.randint(2, max(3, h // 10)),
                       tuple(int(c) for c in np.random.randint(40, 110, 3)), -1)
    if random.random() < 0.5:                                     # JPEG artefacts
        ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, random.randint(30, 90)])
        img = cv2.imdecode(enc, cv2.IMREAD_UNCHANGED)
    return img

sample = render_plate(*random_plate_text(), "private")
Image.fromarray(sample)

# %% [markdown]
# ## 4. Detector dataset (box + 4 corners, YOLO-pose)
# Each scene is either a **real car photo** where the original plate is covered by a Kuwaiti plate warped into the
# real plate's place, or a generated background with a randomly placed plate. Labels:
# `class cx cy w h  x1 y1 2  x2 y2 2  x3 y3 2  x4 y4 2` (normalised, corners TL TR BR BL).
# Splits are made **by plate key**, so the same plate text never appears in two splits.

# %%
# ===================================================================== 4. Scenes + YOLO-pose dataset
DET = DATA / "detection"
if DET.exists():
    shutil.rmtree(DET)
for split in ("train", "val", "test"):
    (DET / "images" / split).mkdir(parents=True, exist_ok=True)
    (DET / "labels" / split).mkdir(parents=True, exist_ok=True)

def split_of(key):
    bucket = int.from_bytes(key.encode(), "little") * 2654435761 % 100
    return "train" if bucket < 80 else "val" if bucket < 90 else "test"

def random_background(size):
    bg = np.zeros((size, size, 3), np.uint8)
    c1, c2 = np.random.randint(0, 255, 3), np.random.randint(0, 255, 3)
    t = np.linspace(0, 1, size)[:, None, None]
    bg[:] = (c1 * (1 - t) + c2 * t).astype(np.uint8)
    for _ in range(random.randint(5, 20)):                       # clutter so the detector learns what is NOT a plate
        p1 = (random.randint(0, size), random.randint(0, size))
        p2 = (p1[0] + random.randint(-200, 200), p1[1] + random.randint(-120, 120))
        colour = tuple(int(c) for c in np.random.randint(0, 255, 3))
        if random.random() < 0.5:
            cv2.rectangle(bg, p1, p2, colour, -1)
        else:
            cv2.line(bg, p1, p2, colour, random.randint(1, 6))
    return bg

def paste_plate(scene, plate_rgb, quad):
    """Warp the canonical plate into the quad (TL TR BR BL) on the scene (BGR)."""
    src = np.float32([[0, 0], [CANONICAL_W, 0], [CANONICAL_W, CANONICAL_H], [0, CANONICAL_H]])
    m = cv2.getPerspectiveTransform(src, np.float32(quad))
    h, w = scene.shape[:2]
    warped = cv2.warpPerspective(cv2.cvtColor(plate_rgb, cv2.COLOR_RGB2BGR), m, (w, h))
    mask = cv2.warpPerspective(np.full((CANONICAL_H, CANONICAL_W), 255, np.uint8), m, (w, h))
    mask = cv2.GaussianBlur(mask, (3, 3), 0).astype(np.float32)[..., None] / 255.0
    return (scene * (1 - mask) + warped * mask).astype(np.uint8)

def jittered_quad(x1, y1, x2, y2, amount):
    w, h = x2 - x1, y2 - y1
    j = lambda: random.uniform(-amount, amount)
    return [[x1 + j() * w, y1 + j() * h], [x2 + j() * w, y1 + j() * h], [x2 + j() * w, y2 + j() * h], [x1 + j() * w, y2 + j() * h]]

def make_scene(size):
    """Returns (BGR scene, [(kind_idx, quad, key), ...])."""
    plates = []
    if REAL_PHOTOS and random.random() < 0.65:
        path, boxes = random.choice(REAL_PHOTOS)
        scene = cv2.imread(str(path))
        if scene is None:
            return make_scene(size)
        sh, sw = scene.shape[:2]
        scale = size / max(sh, sw)
        scene = cv2.resize(scene, (int(sw * scale), int(sh * scale)))
        canvas = np.full((size, size, 3), 114, np.uint8)
        canvas[:scene.shape[0], :scene.shape[1]] = scene
        scene = canvas
        for (x1, y1, x2, y2) in boxes:
            x1, y1, x2, y2 = [v * scale for v in (x1, y1, x2, y2)]
            pad_w, pad_h = (x2 - x1) * 0.06, (y2 - y1) * 0.12        # cover the original plate fully
            quad = jittered_quad(x1 - pad_w, y1 - pad_h, x2 + pad_w, y2 + pad_h, 0.04)
            code, number = random_plate_text()
            kind = random.choices(range(len(KINDS)), weights=KIND_WEIGHTS)[0]
            scene = paste_plate(scene, render_plate(code, number, KINDS[kind]), quad)
            plates.append((kind, quad, f"{code}-{number}"))
    else:
        scene = random_background(size)
        for _ in range(random.choice([1, 1, 1, 2])):
            pw = random.uniform(0.18, 0.6) * size
            ph = pw * CANONICAL_H / CANONICAL_W * random.uniform(0.9, 1.25)
            x1, y1 = random.uniform(0, size - pw), random.uniform(0, size - ph)
            quad = jittered_quad(x1, y1, x1 + pw, y1 + ph, 0.08)
            code, number = random_plate_text()
            kind = random.choices(range(len(KINDS)), weights=KIND_WEIGHTS)[0]
            scene = paste_plate(scene, render_plate(code, number, KINDS[kind]), quad)
            plates.append((kind, quad, f"{code}-{number}"))
    scene = aug_blur_noise(aug_light(scene))
    return scene, plates

def yolo_pose_line(kind, quad, size):
    q = np.clip(np.array(quad, dtype=np.float32), 0, size - 1) / size
    x0, y0, x1, y1 = q[:, 0].min(), q[:, 1].min(), q[:, 0].max(), q[:, 1].max()
    kp = " ".join(f"{x:.6f} {y:.6f} 2" for x, y in q)
    return f"{kind} {(x0 + x1) / 2:.6f} {(y0 + y1) / 2:.6f} {x1 - x0:.6f} {y1 - y0:.6f} {kp}"

SIZE = CFG["det_imgsz"]
scene_rows = []
t0 = time.time()
for i in range(CFG["scenes"]):
    scene, plates = make_scene(SIZE)
    key = plates[0][2]
    split = split_of(key)
    name = f"scene_{i:06d}"
    cv2.imwrite(str(DET / "images" / split / f"{name}.jpg"), scene, [cv2.IMWRITE_JPEG_QUALITY, 92])
    (DET / "labels" / split / f"{name}.txt").write_text("\n".join(yolo_pose_line(k, q, SIZE) for k, q, _ in plates))
    for k, q, key_i in plates:
        scene_rows.append({"image": f"{split}/{name}.jpg", "split": split, "kind": KINDS[k], "key": key_i,
                           "quad": json.dumps(np.round(np.array(q), 1).tolist())})
scenes = pd.DataFrame(scene_rows)
scenes.to_csv(DET / "index.csv", index=False)

# optional: the user's real Kuwaiti photos are added to train (80 %) and test (20 %)
if KUWAIT_REAL_DIR and Path(KUWAIT_REAL_DIR).exists():
    real = pd.read_csv(Path(KUWAIT_REAL_DIR) / "index.csv")
    for _, r in real.iterrows():
        split = "test" if split_of(str(r["key"])) != "train" else "train"
        src = Path(KUWAIT_REAL_DIR) / "images" / r["image"]
        lbl = Path(KUWAIT_REAL_DIR) / "labels" / (Path(r["image"]).stem + ".txt")
        if src.exists() and lbl.exists():
            shutil.copy2(src, DET / "images" / split / f"real_{src.name}")
            shutil.copy2(lbl, DET / "labels" / split / f"real_{src.stem}.txt")
    print("added real Kuwaiti photos:", len(real))

DATA_YAML = DET / "plates.yaml"
DATA_YAML.write_text(
    f"path: {DET.as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\n"
    f"kpt_shape: [4, 3]\nflip_idx: [1, 0, 3, 2]\nnames:\n" + "".join(f"  {i}: {k}\n" for i, k in enumerate(KINDS)))
print(f"{len(scenes)} plates in {CFG['scenes']} scenes, {time.time() - t0:.0f}s")
print(scenes.groupby("split").size())

# %%
# Quick look at a few training scenes with their corner labels
import matplotlib.pyplot as plt
fig, axes = plt.subplots(1, 3, figsize=(15, 5))
for ax, (_, r) in zip(axes, scenes.sample(min(3, len(scenes)), random_state=1).iterrows()):
    img = cv2.cvtColor(cv2.imread(str(DET / "images" / r["image"])), cv2.COLOR_BGR2RGB)
    q = np.array(json.loads(r["quad"]))
    ax.imshow(img); ax.plot(*np.vstack([q, q[:1]]).T, "-o", color="lime"); ax.set_title(f"{r['key']} · {r['kind']}"); ax.axis("off")
plt.show()

# %% [markdown]
# ## 5. Detector: YOLO11n-pose (box + 4 corners)
# Starts from COCO-pose weights. No horizontal flips (plates are not mirror-symmetric). Strong brightness changes for
# day / night bays and summer glare. Licence note: Ultralytics is **AGPL-3.0** – a closed-source commercial app needs an
# Ultralytics Enterprise licence (or an Apache-2.0 detector with the same pipeline).

# %%
# ===================================================================== 5. Train the detector
from ultralytics import YOLO

detector = YOLO("yolo11n-pose.pt")
detector.train(
    data=str(DATA_YAML), imgsz=CFG["det_imgsz"], epochs=CFG["det_epochs"], batch=CFG["det_batch"],
    patience=max(10, CFG["det_epochs"] // 4), optimizer="AdamW", lr0=0.002, cos_lr=True,
    mosaic=1.0, close_mosaic=max(1, CFG["det_epochs"] // 8), degrees=3, perspective=0.0005, fliplr=0.0, hsv_v=0.5,
    pose=12.0, device=0 if DEVICE == "cuda" else "cpu", workers=2 if ON_KAGGLE else 0,
    project=str(RUNS), name="plate_detector", exist_ok=True, plots=False, verbose=False,
)
DET_BEST = RUNS / "plate_detector" / "weights" / "best.pt"
detector = YOLO(str(DET_BEST))
det_metrics = detector.val(data=str(DATA_YAML), split="test", imgsz=CFG["det_imgsz"], plots=False, verbose=False,
                           device=0 if DEVICE == "cuda" else "cpu", workers=0)
DET_RESULTS = {"box_map50": float(det_metrics.box.map50), "pose_map50": float(det_metrics.pose.map50)}
print("Detector test:", DET_RESULTS)

# %% [markdown]
# ## 6. Cell reader: CRNN-CTC on 4 cells
# Training cells are cut **the same way as in the app**: the plate is warped with slightly wrong corners
# (simulating detector error), split into the 4 cells, augmented and resized to 32 px high (shape kept).
# Cells keep their shape (32 px high, padded to 160 px). Vocabulary: 10 Arabic-Indic + 10 English digits (+ CTC blank).

# %%
# ===================================================================== 6a. Cell dataset
REC = DATA / "cells"
if REC.exists():
    shutil.rmtree(REC)
for split in ("train", "val", "test"):
    (REC / split).mkdir(parents=True, exist_ok=True)

def cells_from_plate(plate_rgb, corner_noise=0.03):
    """Place the plate on a small canvas, warp it back with noisy corners, cut the 4 cells (as the app does)."""
    m = 40
    canvas = np.full((CANONICAL_H + 2 * m, CANONICAL_W + 2 * m, 3), np.random.randint(30, 220), np.uint8)
    canvas[m:m + CANONICAL_H, m:m + CANONICAL_W] = cv2.cvtColor(plate_rgb, cv2.COLOR_RGB2BGR)
    canvas = aug_light(canvas)
    n = lambda scale: random.uniform(-corner_noise, corner_noise) * scale
    corners = [[m + n(CANONICAL_W), m + n(CANONICAL_H)], [m + CANONICAL_W + n(CANONICAL_W), m + n(CANONICAL_H)],
               [m + CANONICAL_W + n(CANONICAL_W), m + CANONICAL_H + n(CANONICAL_H)], [m + n(CANONICAL_W), m + CANONICAL_H + n(CANONICAL_H)]]
    plate = warp_plate(canvas, corners)
    return {name: cell_tensor_input(aug_blur_noise(crop)) for name, crop in split_cells(plate).items()}

cell_rows = []
t0 = time.time()
for i in range(CFG["plates"]):
    code, number = random_plate_text()
    key = f"{code}-{number}"
    split = split_of(key)
    cells = cells_from_plate(render_plate(code, number, random.choices(KINDS, weights=KIND_WEIGHTS)[0]))
    texts = {"code_ar": to_arabic_digits(code), "code_lat": code, "num_ar": to_arabic_digits(number), "num_lat": number}
    for name, img in cells.items():
        file = f"{split}/p{i:07d}_{name}.png"
        cv2.imwrite(str(REC / file), img)
        cell_rows.append({"file": file, "split": split, "cell": name, "text": texts[name], "key": key})
cells_df = pd.DataFrame(cell_rows)
cells_df.to_csv(REC / "labels.csv", index=False)
print(f"{len(cells_df)} cells from {CFG['plates']} plates in {time.time() - t0:.0f}s")
print(cells_df.groupby("split").size())

# %%
# ===================================================================== 6b. CRNN model + training
from torch.utils.data import Dataset, DataLoader

BLANK = 0
VOCAB = ["<blank>"] + list(CHARSET)
CHAR_TO_ID = {c: i for i, c in enumerate(VOCAB)}

class Cell_Dataset(Dataset):
    def __init__(self, frame, train):
        self.df, self.train = frame.reset_index(drop=True), train
    def __len__(self):
        return len(self.df)
    def __getitem__(self, i):
        row = self.df.iloc[i]
        img = cv2.imread(str(REC / row["file"]), cv2.IMREAD_GRAYSCALE)
        if self.train and random.random() < 0.5:                   # small shift / scale jitter
            m = cv2.getRotationMatrix2D((CELL_W / 2, CELL_H / 2), random.uniform(-2, 2), random.uniform(0.92, 1.06))
            m[:, 2] += (random.uniform(-3, 3), random.uniform(-2, 2))
            img = cv2.warpAffine(img, m, (CELL_W, CELL_H), borderMode=cv2.BORDER_REPLICATE)
        x = torch.from_numpy(img).float().div(255).sub(0.5).div(0.5).unsqueeze(0)
        y = torch.tensor([CHAR_TO_ID[c] for c in str(row["text"])], dtype=torch.long)
        return x, y

def collate(batch):
    xs, ys = zip(*batch)
    return torch.stack(xs), torch.cat(ys), torch.tensor([len(y) for y in ys])

class CRNN(nn.Module):
    """MobileNetV3-Small (stride 16 in height, 8 in width) + BiLSTM + CTC head for 32x100 digit cells."""
    def __init__(self, num_classes=len(VOCAB)):
        super().__init__()
        try:
            mb = torchvision.models.mobilenet_v3_small(weights="DEFAULT").features
        except Exception:
            mb = torchvision.models.mobilenet_v3_small(weights=None).features
        mb[0][0] = nn.Conv2d(1, 16, 3, stride=(2, 1), padding=1, bias=False)
        self.backbone = mb[:9]
        self.rnn = nn.LSTM(48, 96, num_layers=2, bidirectional=True, batch_first=True, dropout=0.1)
        self.head = nn.Linear(192, num_classes)
    def forward(self, x):
        f = self.backbone(x).mean(dim=2).permute(0, 2, 1)   # average over height (ONNX/TFLite friendly) -> B x T x C
        out, _ = self.rnn(f)
        return self.head(out).log_softmax(-1)

def greedy_decode(log_probs):
    ids = log_probs.argmax(-1).cpu().numpy()
    probs = log_probs.exp().max(-1).values.cpu().numpy()
    texts, confs = [], []
    for seq, p in zip(ids, probs):
        out, prev, keep = [], BLANK, []
        for t, (c, pc) in enumerate(zip(seq, p)):
            if c != prev and c != BLANK:
                out.append(VOCAB[c]); keep.append(pc)
            prev = c
        texts.append("".join(out))
        confs.append(float(min(keep)) if keep else 0.0)
    return texts, confs

reader = CRNN().to(DEVICE)
print(f"{sum(p.numel() for p in reader.parameters()) / 1e6:.2f} M params, time steps:",
      reader(torch.zeros(1, 1, CELL_H, CELL_W, device=DEVICE)).shape[1])

train_dl = DataLoader(Cell_Dataset(cells_df[cells_df.split == "train"], True), batch_size=CFG["rec_batch"], shuffle=True,
                      num_workers=2 if ON_KAGGLE else 0, collate_fn=collate, drop_last=True)
val_dl = DataLoader(Cell_Dataset(cells_df[cells_df.split == "val"], False), batch_size=512, shuffle=False,
                    num_workers=2 if ON_KAGGLE else 0, collate_fn=collate)

def evaluate_reader(model, loader):
    model.eval(); right = total = 0
    with torch.no_grad():
        for x, y, lengths in loader:
            texts, _ = greedy_decode(model(x.to(DEVICE)))
            truth = [["".join(VOCAB[i] for i in seg.tolist())] for seg in torch.split(y, lengths.tolist())]
            right += sum(t == tr[0] for t, tr in zip(texts, truth)); total += len(texts)
    return right / max(total, 1)

ctc = nn.CTCLoss(blank=BLANK, zero_infinity=True)
optim = torch.optim.AdamW(reader.parameters(), lr=3e-3, weight_decay=1e-4)
steps = CFG["rec_epochs"] * max(1, len(train_dl))
sched = torch.optim.lr_scheduler.OneCycleLR(optim, max_lr=3e-3, total_steps=steps, pct_start=0.15)
scaler = torch.amp.GradScaler("cuda", enabled=DEVICE == "cuda")
READER_BEST = RUNS / "cell_reader_best.pt"
best_acc = -1.0
for epoch in range(CFG["rec_epochs"]):
    reader.train()
    for x, y, lengths in train_dl:
        x = x.to(DEVICE)
        with torch.autocast(DEVICE, enabled=DEVICE == "cuda"):
            log_probs = reader(x)
        T = log_probs.size(1)
        loss = ctc(log_probs.float().permute(1, 0, 2), y, torch.full((x.size(0),), T, dtype=torch.long), lengths)
        optim.zero_grad(set_to_none=True)
        scaler.scale(loss).backward(); scaler.step(optim); scaler.update(); sched.step()
    acc = evaluate_reader(reader, val_dl)
    if acc > best_acc:
        best_acc = acc
        torch.save(reader.state_dict(), READER_BEST)
    print(f"epoch {epoch + 1:02d}/{CFG['rec_epochs']}  loss {loss.item():.4f}  val cell accuracy {acc:.4f}")
reader.load_state_dict(torch.load(READER_BEST, map_location=DEVICE))
test_dl = DataLoader(Cell_Dataset(cells_df[cells_df.split == "test"], False), batch_size=512, collate_fn=collate)
READER_RESULTS = {"cell_accuracy_test": evaluate_reader(reader, test_dl)}
print("Reader test:", READER_RESULTS)

# %% [markdown]
# ## 7. End-to-end evaluation (what the worker experiences)
# On the **test scenes** (never seen in training): detector + corners → warp → 4 cells → reader →
# Arabic/English cross-check → plate key. Reports exact match, detection rate, row-agreement rate and latency.

# %%
# ===================================================================== 7. End-to-end pipeline
CONF_THRESHOLD = 0.85

def read_plates(image_bgr):
    """Image -> list of dicts {key, confidence, agreed, corners} for every detected plate."""
    result = detector.predict(image_bgr, imgsz=CFG["det_imgsz"], conf=0.35, verbose=False,
                              device=0 if DEVICE == "cuda" else "cpu")[0]
    if result.keypoints is None or len(result.boxes) == 0:
        return []
    outputs = []
    batch, order = [], []
    for corners in result.keypoints.xy.cpu().numpy():
        cells = split_cells(warp_plate(image_bgr, corners))
        for name in CELL_NAMES:
            batch.append(cell_tensor_input(cells[name])); order.append(name)
    x = torch.from_numpy(np.stack(batch)).float().div(255).sub(0.5).div(0.5).unsqueeze(1).to(DEVICE)
    reader.eval()
    with torch.no_grad():
        texts, confs = greedy_decode(reader(x))
    for p, corners in enumerate(result.keypoints.xy.cpu().numpy()):
        t, c = texts[p * 4:(p + 1) * 4], confs[p * 4:(p + 1) * 4]
        code, c_conf, c_ok = cross_check(t[0], t[1], c[0], c[1])
        number, n_conf, n_ok = cross_check(t[2], t[3], c[2], c[3])
        key = f"{code}-{number}" if is_valid(code, number) else ""
        outputs.append({"key": key, "confidence": min(c_conf, n_conf), "agreed": c_ok and n_ok, "corners": corners})
    return outputs

test_index = scenes[scenes.split == "test"].drop_duplicates("image").head(CFG["eval_images"])
rows = []
for _, r in test_index.iterrows():
    img = cv2.imread(str(DET / "images" / r["image"]))
    truth = set(scenes[scenes.image == r["image"]]["key"])
    t0 = time.time(); reads = read_plates(img); ms = (time.time() - t0) * 1000
    best = max(reads, key=lambda o: o["confidence"]) if reads else None
    rows.append({"image": r["image"], "truth": "|".join(sorted(truth)), "pred": best["key"] if best else "",
                 "correct": bool(best and best["key"] in truth), "detected": bool(reads),
                 "agreed": bool(best and best["agreed"]), "confident": bool(best and best["confidence"] >= CONF_THRESHOLD), "ms": ms})
e2e = pd.DataFrame(rows)
E2E_RESULTS = {
    "images": len(e2e),
    "exact_match": float(e2e.correct.mean()),
    "detection_rate": float(e2e.detected.mean()),
    "row_agreement": float(e2e.agreed.mean()),
    "exact_match_when_agreed": float(e2e[e2e.agreed].correct.mean()) if e2e.agreed.any() else 0.0,
    "sent_to_server_fallback": float(1 - e2e.confident.mean()),
    "median_latency_ms": float(e2e.ms.median()),
}
print(json.dumps(E2E_RESULTS, indent=2))
e2e[~e2e.correct].head(10)

# %%
# A few test images with what the pipeline read
fig, axes = plt.subplots(2, 3, figsize=(16, 9))
for ax, (_, r) in zip(axes.ravel(), e2e.sample(min(6, len(e2e)), random_state=3).iterrows()):
    img = cv2.imread(str(DET / "images" / r["image"]))
    for o in read_plates(img):
        q = o["corners"].astype(int)
        cv2.polylines(img, [q], True, (0, 255, 0) if o["agreed"] else (0, 165, 255), 2)
    ax.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)); ax.axis("off")
    ax.set_title(f"read {r['pred'] or '—'} · truth {r['truth']}", color="green" if r["correct"] else "red")
plt.tight_layout(); plt.show()

# %% [markdown]
# ## 8. Export
# * Detector → **ONNX** (server / Inference Service) and, in `full` mode, **TFLite int8** (Android LiteRT; needs TensorFlow,
#   so it is optional and can take a while). Core ML must be exported on macOS.
# * Cell reader → **ONNX**, checked against PyTorch with ONNX Runtime.
# * `model_card.json` + `layout.json` + `vocab.json`, all zipped into one file to download from the Output tab.

# %%
# ===================================================================== 8. Export + package
import onnx, onnxruntime as ort

export = {}
try:
    onnx_path = Path(detector.export(format="onnx", imgsz=CFG["det_imgsz"], simplify=True))
except Exception as error:
    print("simplified ONNX export failed, retrying without simplify:", error)
    onnx_path = Path(detector.export(format="onnx", imgsz=CFG["det_imgsz"], simplify=False))
shutil.copy2(onnx_path, PKG / "plate_detector.onnx"); export["detector_onnx"] = True
shutil.copy2(DET_BEST, PKG / "plate_detector.pt")
if CFG["export_tflite"]:
    try:
        tfl = Path(detector.export(format="tflite", imgsz=CFG["det_imgsz"], int8=True, data=str(DATA_YAML)))
        shutil.copy2(tfl, PKG / "plate_detector_int8.tflite"); export["detector_tflite"] = True
    except Exception as error:
        print("TFLite export skipped:", error); export["detector_tflite"] = False

reader.eval().cpu()
dummy = torch.randn(2, 1, CELL_H, CELL_W)
torch.onnx.export(reader, dummy, str(PKG / "plate_cell_reader.onnx"), input_names=["cells"], output_names=["log_probs"],
                  dynamic_axes={"cells": {0: "batch"}, "log_probs": {0: "batch"}}, opset_version=17)
onnx.checker.check_model(onnx.load(str(PKG / "plate_cell_reader.onnx")))
session = ort.InferenceSession(str(PKG / "plate_cell_reader.onnx"), providers=["CPUExecutionProvider"])
diff = float(np.abs(session.run(None, {"cells": dummy.numpy()})[0] - reader(dummy).detach().numpy()).max())
print("ONNX vs PyTorch max difference:", diff)
assert diff < 1e-3
export["reader_onnx"] = True
torch.save(reader.state_dict(), PKG / "plate_cell_reader.pt")
reader.to(DEVICE)

(PKG / "vocab.json").write_text(json.dumps({"blank": 0, "vocab": VOCAB}, ensure_ascii=False, indent=1), encoding="utf-8")
(PKG / "layout.json").write_text(json.dumps({"canonical": [CANONICAL_W, CANONICAL_H], "cells": CELLS,
                                             "cell_input": [1, 1, CELL_H, CELL_W], "corner_order": "TL,TR,BR,BL"}, indent=1))
card = {
    "kind": "plate", "market": "Kuwait", "version": MODEL_VERSION, "run_mode": RUN_MODE, "created": time.strftime("%Y-%m-%d %H:%M"),
    "detector": {"arch": "YOLO11n-pose (box + 4 corners)", "classes": KINDS, "input": f"1x3x{CFG['det_imgsz']}x{CFG['det_imgsz']} RGB 0-1", **DET_RESULTS},
    "reader": {"arch": "CRNN-CTC MobileNetV3-Small + BiLSTM", "input": f"Nx1x{CELL_H}x{CELL_W} gray, (x/255-0.5)/0.5", **READER_RESULTS},
    "end_to_end": E2E_RESULTS,
    "data": {"synthetic_plates": CFG["plates"], "scenes": CFG["scenes"], "real_background_photos": len(REAL_PHOTOS),
             "real_kuwaiti_photos": bool(KUWAIT_REAL_DIR)},
    "export": export,
    "notes": "Base model for Kuwaiti plates. No station data. Plate colours are placeholders until MOI rules are confirmed; "
             "evaluate on real Kuwaiti photos before production.",
}
(PKG / "model_card.json").write_text(json.dumps(card, indent=1, default=float))

ZIP = WORK / f"plate_package_{MODEL_VERSION}.zip"
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for f in PKG.iterdir():
        z.write(f, f.name)
print("Package:", ZIP, f"{ZIP.stat().st_size / 1e6:.1f} MB")
print(json.dumps({k: v for k, v in card.items() if k in ("detector", "reader", "end_to_end", "export")}, indent=1, default=float))
