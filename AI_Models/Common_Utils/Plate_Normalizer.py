"""Kuwaiti licence-plate text rules (launch market: Kuwait).

A Kuwaiti plate carries a CODE (1-2 digits) and a NUMBER (up to 5 digits). Each is printed twice:
Arabic-Indic digits on the top row and English digits on the bottom row. There are no letters.

Display form : "١٢ / ٣٤٥٦٧"  and  "12 / 34567"
Normalised   : "12-34567"   (key used for matching and UNIQUE(tenant_id, plate_normalized))

Because every value is printed twice, the reader can CROSS-CHECK the Arabic row against the English row:
agreement -> high confidence; disagreement -> lower confidence (server fallback / ask the worker).
The exact code ranges per plate type must be confirmed against current MOI rules in Phase 0.
"""
from __future__ import annotations

import re
from typing import Optional, Tuple

ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
EASTERN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"   # Persian forms sometimes produced by OCR
LATIN_DIGITS = "0123456789"
CHARSET = ARABIC_INDIC_DIGITS + LATIN_DIGITS   # what the cell recogniser can output

CODE_MAX_DIGITS = 2
NUMBER_MAX_DIGITS = 5


def to_western_digits(text: str) -> str:
    table = {ord(a): str(i) for i, a in enumerate(ARABIC_INDIC_DIGITS)}
    table.update({ord(a): str(i) for i, a in enumerate(EASTERN_DIGITS)})
    return text.translate(table)


def to_arabic_digits(text: str) -> str:
    return "".join(ARABIC_INDIC_DIGITS[int(c)] if c.isdigit() else c for c in to_western_digits(text))


def parse(text: str) -> Optional[Tuple[str, str]]:
    """Any OCR / typed plate -> (code, number). Accepts "12 34567", "12-34567", "12/34567", "١٢ ٣٤٥٦٧"."""
    groups = re.findall(r"\d+", to_western_digits(text))
    if len(groups) == 2:
        a, b = groups
        # the code is the short group; on the plate it sits left of the number
        code, number = (a, b) if len(a) <= len(b) else (b, a)
    elif len(groups) == 1 and len(groups[0]) > NUMBER_MAX_DIGITS:
        # typed without a separator, e.g. "1234567" -> code "12", number "34567"
        joined = groups[0]
        code, number = joined[: len(joined) - NUMBER_MAX_DIGITS], joined[-NUMBER_MAX_DIGITS:]
    else:
        return None
    return (code.lstrip("0") or "0", number) if is_valid(code, number) else None


def is_valid(code: str, number: str) -> bool:
    return (re.fullmatch(rf"\d{{1,{CODE_MAX_DIGITS}}}", code) is not None and 1 <= int(code) <= 99
            and re.fullmatch(rf"\d{{1,{NUMBER_MAX_DIGITS}}}", number) is not None and int(number) > 0)


def normalize(text: str) -> str:
    """Matching key "CODE-NUMBER", or "" when the text is not a valid Kuwaiti plate."""
    parsed = parse(text)
    return f"{parsed[0]}-{parsed[1]}" if parsed else ""


def cross_check(arabic_read: str, latin_read: str, arabic_conf: float, latin_conf: float) -> Tuple[str, float, bool]:
    """Combine the two printed rows of ONE cell (code or number).
    Returns (value in English digits, confidence, agreed)."""
    a, l = to_western_digits(arabic_read).strip(), latin_read.strip()
    if a and a == l:
        # two independent readings agree: boost confidence (capped)
        return l, min(1.0, 1 - (1 - arabic_conf) * (1 - latin_conf) * 4), True
    best, conf = (a, arabic_conf) if arabic_conf >= latin_conf else (l, latin_conf)
    return best, conf * 0.6, False       # disagreement: never trusted enough to skip confirmation


def display_form(code: str, number: str) -> Tuple[str, str]:
    """(Arabic row, English row) as printed on the plate."""
    return f"{to_arabic_digits(code)} / {to_arabic_digits(number)}", f"{code} / {number}"


if __name__ == "__main__":
    assert normalize("12 34567") == "12-34567"
    assert normalize("١٢ ٣٤٥٦٧") == "12-34567"
    assert normalize("12/34567") == "12-34567"
    assert normalize("34567 12") == "12-34567"
    assert normalize("1234567") == "12-34567"
    assert normalize("abc") == ""
    assert cross_check("٣٤٥٦٧", "34567", 0.9, 0.9)[2] is True
    assert cross_check("٣٤٥٦٧", "34561", 0.9, 0.8) == ("34567", 0.9 * 0.6, False)
    print("Plate_Normalizer self-test OK")
