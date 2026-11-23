"""Egyptian licence-plate text normalisation (spec section 11.1).

Display form : Arabic letters + Arabic-Indic digits, e.g.  "ق ص ر ١٤٢٧"
Normalised   : Latin key used for matching / UNIQUE(tenant_id, plate_normalized), e.g. "QCR1427"

The exact letter table must be agreed with the owner in Phase 0; this is the starting proposal.
Egyptian plates use 17 letters (no alef-hamza variants, no taa marbuta, etc.).
"""
from __future__ import annotations

import re

ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
EASTERN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"   # Persian forms sometimes produced by OCR

LETTER_TO_LATIN = {
    "ا": "A", "أ": "A", "ب": "B", "ج": "G", "د": "D", "ر": "R", "س": "S", "ص": "C",
    "ط": "T", "ع": "E", "ف": "F", "ق": "Q", "ك": "K", "ل": "L", "م": "M", "ن": "N",
    "ه": "H", "و": "W", "ى": "Y", "ي": "Y",
}
PLATE_LETTERS = "ابجدرسصطعفقكلمنهوى"   # charset used by the recogniser
CHARSET = PLATE_LETTERS + ARABIC_INDIC_DIGITS + "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def to_western_digits(text: str) -> str:
    table = {ord(a): str(i) for i, a in enumerate(ARABIC_INDIC_DIGITS)}
    table.update({ord(a): str(i) for i, a in enumerate(EASTERN_DIGITS)})
    return text.translate(table)


def normalize(text: str) -> str:
    """Any OCR / typed plate -> matching key. Letters first, then digits."""
    text = to_western_digits(text.strip())
    letters = "".join(LETTER_TO_LATIN.get(ch, ch.upper()) for ch in text if not ch.isdigit() and not ch.isspace())
    digits = "".join(ch for ch in text if ch.isdigit())
    letters = re.sub(r"[^A-Z]", "", letters)
    return f"{letters}{digits}"


def is_valid_egyptian(text: str) -> bool:
    """Private plates: 1-3 letters + 1-4 digits (older formats also exist; extend in Phase 0)."""
    key = normalize(text)
    return bool(re.fullmatch(r"[A-Z]{1,3}[0-9]{1,4}", key)) or bool(re.fullmatch(r"[A-Z]{2,3}[0-9]{3,4}", key))


def display_form(letters: str, digits: str) -> str:
    """Build the on-plate display: spaced Arabic letters + Arabic-Indic digits."""
    arabic_digits = "".join(ARABIC_INDIC_DIGITS[int(d)] for d in digits)
    return f"{' '.join(letters)} {arabic_digits}"


if __name__ == "__main__":
    assert normalize("ق ص ر ١٤٢٧") == "QCR1427"
    assert normalize("qcr 1427") == "QCR1427"
    print("Plate_Normalizer self-test OK")
