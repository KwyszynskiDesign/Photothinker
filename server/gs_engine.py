#!/usr/bin/env python3
"""
gs_engine.py - Prawdziwa separacja kolorow z PDF przy uzyciu Ghostscript.

Kluczowa roznica wzgledem starego podejscia:
  STARE: PyMuPDF renderuje strone do RGB/CMYK, a potem algorytm "zgaduje"
         ktore piksele naleza do danego spot coloru (estimate_spot_channel).
         To powodowalo, ze kanal "Cyan" pokazywal interpretacje algorytmu,
         a nie faktyczna plyte Cyan z pliku.

  NOWE:  Ghostscript urzadzenie 'tiffsep' renderuje KAZDA separacje osobno
         dokladnie tak, jak jest zdefiniowana w pliku PDF:
           - Cyan, Magenta, Yellow, Black  (proces)
           - kazdy Spot / Pantone           (np. "PANTONE 485 C")
           - kazda warstwa techniczna       (np. "CutContour", "Dieline", "Varnish")
         Otrzymujemy realne natezenie atramentu per plyta -> jak prawdziwy RIP.

Konwencja danych zwracanych przez ten modul:
  Kazda plyta to numpy.uint8 (H, W), gdzie:
     0   = brak atramentu (papier)
     255 = pelne krycie atramentem (100%)
  (tiffsep zwraca odwrotnie: 255=papier; tutaj juz znormalizowane do "ink density").
"""

from __future__ import annotations

import os
import re
import glob
import shutil
import tempfile
import subprocess
from dataclasses import dataclass, field

import numpy as np
from PIL import Image


# ---------------------------------------------------------------------------
# WYKRYWANIE GHOSTSCRIPT
# ---------------------------------------------------------------------------

def find_ghostscript() -> str | None:
    """Zwraca sciezke do binarki Ghostscript lub None jesli nie znaleziono."""
    candidates = [
        os.environ.get("GHOSTSCRIPT_BIN"),
        "gs",            # Linux / macOS
        "gswin64c",      # Windows 64-bit (console)
        "gswin32c",      # Windows 32-bit (console)
    ]
    for c in candidates:
        if not c:
            continue
        path = shutil.which(c)
        if path:
            return path
    # Typowe sciezki instalacyjne na Windows
    for base in [r"C:\Program Files\gs", r"C:\Program Files (x86)\gs"]:
        if os.path.isdir(base):
            for ver in sorted(os.listdir(base), reverse=True):
                exe = os.path.join(base, ver, "bin", "gswin64c.exe")
                if os.path.isfile(exe):
                    return exe
                exe = os.path.join(base, ver, "bin", "gswin32c.exe")
                if os.path.isfile(exe):
                    return exe
    return None


GS_BIN = find_ghostscript()
HAS_GHOSTSCRIPT = GS_BIN is not None


# ---------------------------------------------------------------------------
# MODEL DANYCH
# ---------------------------------------------------------------------------

@dataclass
class Plate:
    """Pojedyncza plyta drukarska / separacja."""
    name: str                       # dokladna nazwa z pliku (np. "PANTONE 485 C")
    kind: str                       # 'process' | 'spot' | 'tech'
    data: np.ndarray = field(repr=False)  # uint8 (H,W), 0=papier 255=pelny atrament
    display_color: str = "#000000"  # kolor do podgladu (hex)


# Standardowe nazwy procesowe (tak nazywa je tiffsep)
PROCESS_NAMES = {"cyan", "magenta", "yellow", "black"}

PROCESS_DISPLAY = {
    "cyan": "#00AEEF",
    "magenta": "#EC008C",
    "yellow": "#FFF200",
    "black": "#231F20",
}

# Standardowe katy ekranowania (AM halftone)
PROCESS_ANGLES = {
    "cyan": 15.0,
    "magenta": 75.0,
    "yellow": 0.0,
    "black": 45.0,
}


# ---------------------------------------------------------------------------
# PARSOWANIE NAZW PLIKOW TIFFSEP
# ---------------------------------------------------------------------------

# tiffsep tworzy pliki w formacie:  base-PAGE(NAZWA SEPARACJI).tif
_SEP_RE = re.compile(r"^(?P<base>.+?)-(?P<page>\d+)\((?P<name>.+)\)\.tif$", re.I)


def _classify(name: str, tech_hints) -> str:
    lower = name.lower().strip()
    if lower in PROCESS_NAMES:
        return "process"
    for hint in tech_hints:
        if hint in lower:
            return "tech"
    return "spot"


# ---------------------------------------------------------------------------
# GLOWNA FUNKCJA: RENDEROWANIE SEPARACJI
# ---------------------------------------------------------------------------

def render_separations(
    pdf_bytes: bytes,
    page_index: int,
    dpi: int = 150,
    tech_hints=None,
    recipe_lookup=None,
    max_spots: int = 30,
) -> tuple[list[Plate], int, int]:
    """
    Renderuje WSZYSTKIE separacje strony PDF przy uzyciu Ghostscript tiffsep.

    Args:
        pdf_bytes:     zawartosc pliku PDF
        page_index:    indeks strony (0-based)
        dpi:           rozdzielczosc renderowania
        tech_hints:    lista slow-kluczy klasyfikujacych warstwy techniczne
        recipe_lookup: opcjonalna funkcja name -> (C,M,Y,K) dla koloru podgladu spotu
        max_spots:     maks. liczba kanalow spot

    Returns:
        (lista Plate, width, height)

    Raises:
        RuntimeError jesli Ghostscript niedostepny lub renderowanie sie nie powiodlo.
    """
    if not HAS_GHOSTSCRIPT:
        raise RuntimeError("Ghostscript nie jest zainstalowany.")

    if tech_hints is None:
        tech_hints = []

    page_no = page_index + 1  # Ghostscript liczy od 1

    with tempfile.TemporaryDirectory(prefix="rip_sep_") as tmp:
        pdf_path = os.path.join(tmp, "in.pdf")
        with open(pdf_path, "wb") as fh:
            fh.write(pdf_bytes)

        out_pattern = os.path.join(tmp, "sep-%d.tif")

        cmd = [
            GS_BIN,
            "-dBATCH", "-dNOPAUSE", "-dSAFER", "-dQUIET",
            "-sDEVICE=tiffsep",
            f"-r{dpi}",
            f"-dFirstPage={page_no}",
            f"-dLastPage={page_no}",
            f"-dMaxSpots={max_spots}",
            "-dDOINTERPOLATE",
            f"-sOutputFile={out_pattern}",
            pdf_path,
        ]

        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300
        )
        # Ghostscript czesto zwraca 0 nawet przy naprawialnych bledach.
        # Sprawdzamy czy powstaly pliki.
        produced = glob.glob(os.path.join(tmp, "sep-*(*).tif"))
        if not produced:
            raise RuntimeError(
                "Ghostscript nie wygenerowal separacji. "
                f"stderr: {proc.stderr[:500]}"
            )

        plates: list[Plate] = []
        width = height = 0

        # Stabilna kolejnosc: najpierw proces CMYK, potem reszta
        def sort_key(path):
            m = _SEP_RE.match(os.path.basename(path))
            name = m.group("name") if m else os.path.basename(path)
            lower = name.lower()
            order = {"cyan": 0, "magenta": 1, "yellow": 2, "black": 3}
            return (order.get(lower, 99), lower)

        for path in sorted(produced, key=sort_key):
            base = os.path.basename(path)
            m = _SEP_RE.match(base)
            if not m:
                continue
            if int(m.group("page")) != page_no:
                continue
            name = m.group("name")

            img = Image.open(path)
            if img.mode != "L":
                img = img.convert("L")
            arr = np.asarray(img, dtype=np.uint8)

            # tiffsep: 255=papier, 0=pelny atrament -> odwracamy na "ink density"
            ink = 255 - arr

            # Pomijaj kompletnie puste plyty proces (np. brak Cyan w pliku)
            kind = _classify(name, tech_hints)

            height, width = ink.shape[:2]

            display = _display_color(name, kind, recipe_lookup)
            plates.append(Plate(name=name, kind=kind, data=ink, display_color=display))

        if not plates:
            raise RuntimeError("Brak prawidlowych separacji po renderowaniu.")

        return plates, width, height


def _display_color(name: str, kind: str, recipe_lookup) -> str:
    lower = name.lower().strip()
    if lower in PROCESS_DISPLAY:
        return PROCESS_DISPLAY[lower]
    # Dla spotow probujemy realny kolor z recepty CMYK
    if recipe_lookup is not None:
        try:
            recipe = recipe_lookup(name)
            if recipe:
                c, m, y, k = [v / 100.0 for v in recipe]
                r = int(255 * (1 - c) * (1 - k))
                g = int(255 * (1 - m) * (1 - k))
                b = int(255 * (1 - y) * (1 - k))
                return f"#{r:02x}{g:02x}{b:02x}"
        except Exception:
            pass
    if kind == "tech":
        return "#00B894"   # zielony dla warstw technicznych / diecut
    return "#FF6B35"       # pomaranczowy domyslny dla spotu


def process_angle(name: str) -> float:
    return PROCESS_ANGLES.get(name.lower().strip(), 45.0)


if __name__ == "__main__":
    # Szybki self-test
    print("Ghostscript:", GS_BIN or "NIE ZNALEZIONO")
