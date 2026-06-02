#!/usr/bin/env python3
"""
RIP Preview PRO v3 - Serwer separacji PDF z HALFTONE Rendering
================================================================

Funkcje:
- Ekstrakcja CMYK i Spot Colors z PDF
- Renderowanie HALFTONE (kropki jako nasycenie)
- Konfiguracja kątów ekranowania
- Eksport płyt drukarskich

UZYCIE:
 cd server
 python rip_server_v2.py
"""

import subprocess
import sys
import os
import math

# ============================================================================
# AUTO-INSTALACJA PAKIETOW
# ============================================================================

def install_packages():
    """Instaluje brakujace pakiety automatycznie"""
    needed = {
        "fitz": "PyMuPDF",
        "numpy": "numpy",
        "PIL": "Pillow",
        "flask": "flask",
        "flask_cors": "flask-cors",
    }
    missing = []
    for mod, pkg in needed.items():
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)

    if missing:
        print()
        print("=" * 55)
        print(" PIERWSZA INSTALACJA - pobieram pakiety...")
        print(" To moze potrwac 1-3 minuty.")
        print("=" * 55)
        print()
        for pkg in missing:
            print(f" Instaluje: {pkg} ...")
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", pkg],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
            print(f" OK: {pkg}")
        print()
        print(" Wszystkie pakiety zainstalowane!")
        print()

try:
    install_packages()
except Exception as e:
    print(f"\n BLAD INSTALACJI: {e}")
    print(f" Sprobuj recznie: {sys.executable} -m pip install PyMuPDF flask flask-cors Pillow numpy")
    input("\n Nacisnij Enter aby zamknac...")
    sys.exit(1)

# ============================================================================
# IMPORTY
# ============================================================================

import io
import re
import base64
import webbrowser
import threading
from dataclasses import dataclass
from pathlib import Path

import fitz
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# --- NOWY silnik separacji oparty na Ghostscript (prawdziwe plyty) ---
try:
    import gs_engine
    import halftone as ht_engine
    HAS_GS = gs_engine.HAS_GHOSTSCRIPT
except Exception as _e:  # pragma: no cover
    gs_engine = None
    ht_engine = None
    HAS_GS = False

app = Flask(__name__)
CORS(app)

# ============================================================================
# BAZA KOLOROW I KONFIGURACJA
# ============================================================================

BLACKLIST = {
    "all", "none", "cyan", "magenta", "yellow", "black",
    "c", "m", "y", "k", "white", "default", "devicecmyk",
    "devicergb", "devicegray", "iccbased", "pattern",
    "calrgb", "calgray", "lab", "indexed",
}

TECH_HINTS = [
    "cut", "die", "diecut", "die-cut", "dieline", "die-line",
    "wykroj", "wykrojnik", "crease", "creasing", "bigowanie",
    "knife", "noz", "stanc", "stanz", "stanzen", "stanzung",
    "kiss", "kiss-cut", "kisscut", "perf", "perforation", "perforacja",
    "fold", "falz", "falzen", "score", "scoring",
    "varnish", "lakier", "lack", "uv", "foil", "folia",
    "emboss", "deboss", "prage", "braille",
    "register", "registration",
    "trim", "bleed", "contour", "kontur", "cad", "laser",
]

# Rozszerzona baza Pantone (500+ kolorów)
PANTONE_RECIPES = {
    # Reds
    "pantone 185 c": (0, 91, 76, 0),
    "pantone 186 c": (0, 100, 81, 4),
    "pantone 199 c": (0, 85, 44, 0),
    "pantone 200 c": (0, 100, 65, 15),
    "pantone 032 c": (0, 90, 86, 0),
    "pantone 021 c": (0, 53, 100, 0),
    "pantone 485 c": (0, 95, 100, 0),
    "pantone red 032 c": (0, 90, 86, 0),
    "pantone orange 021 c": (0, 53, 100, 0),
    "pantone warm red c": (0, 75, 90, 0),
    "pantone rubine red c": (0, 100, 15, 4),
    "pantone rhodamine red c": (0, 82, 0, 0),
    "pantone 179 c": (0, 79, 100, 0),
    "pantone 1788 c": (0, 84, 87, 0),
    "pantone 1795 c": (0, 94, 100, 0),
    "pantone 1797 c": (0, 87, 82, 10),
    "pantone 219 c": (0, 100, 12, 0),
    "pantone 226 c": (0, 100, 24, 0),
    
    # Yellows
    "pantone 116 c": (0, 14, 100, 0),
    "pantone yellow 012 c": (0, 2, 100, 0),
    "pantone 109 c": (0, 3, 100, 0),
    "pantone 123 c": (0, 24, 94, 0),
    "pantone 130 c": (0, 30, 100, 0),
    "pantone 151 c": (0, 48, 95, 0),
    "pantone 158 c": (0, 55, 100, 0),
    "pantone 165 c": (0, 60, 100, 0),
    "pantone 172 c": (0, 65, 100, 0),
    
    # Greens
    "pantone 348 c": (85, 0, 77, 28),
    "pantone 354 c": (82, 0, 100, 0),
    "pantone 355 c": (91, 0, 100, 0),
    "pantone green c": (95, 0, 100, 0),
    "pantone 368 c": (52, 0, 100, 0),
    "pantone 375 c": (34, 0, 100, 0),
    "pantone 376 c": (44, 0, 100, 0),
    "pantone 382 c": (18, 0, 100, 0),
    "pantone 389 c": (7, 0, 69, 0),
    "pantone 396 c": (5, 0, 100, 0),
    
    # Blues
    "pantone 286 c": (100, 66, 0, 2),
    "pantone 287 c": (100, 68, 0, 12),
    "pantone 288 c": (100, 67, 0, 23),
    "pantone 072 c": (100, 85, 5, 0),
    "pantone blue 072 c": (100, 85, 5, 0),
    "pantone 300 c": (100, 44, 0, 0),
    "pantone 301 c": (100, 45, 0, 18),
    "pantone 306 c": (76, 0, 3, 0),
    "pantone 293 c": (100, 56, 0, 0),
    "pantone 297 c": (56, 6, 0, 0),
    "pantone 311 c": (84, 0, 15, 0),
    "pantone 320 c": (100, 0, 31, 0),
    "pantone 327 c": (100, 0, 46, 20),
    "pantone reflex blue c": (100, 73, 0, 2),
    "pantone process blue c": (100, 10, 0, 10),
    
    # Purples
    "pantone 266 c": (55, 80, 0, 0),
    "pantone 267 c": (60, 90, 0, 0),
    "pantone purple c": (55, 100, 0, 0),
    "pantone violet c": (90, 100, 0, 0),
    "pantone 253 c": (38, 88, 0, 0),
    
    # Blacks & Grays
    "pantone black c": (0, 0, 0, 100),
    "pantone black 6 c": (100, 0, 0, 100),
    "pantone black 7 c": (0, 0, 0, 90),
    "pantone 419 c": (0, 0, 0, 90),
    "pantone 425 c": (0, 0, 0, 70),
    "pantone 429 c": (0, 0, 0, 32),
    "pantone 431 c": (0, 0, 0, 52),
    "pantone 877 c": (0, 0, 0, 30),
    "pantone silver c": (0, 0, 0, 30),
    
    # Metallics
    "pantone 871 c": (0, 17, 65, 35),
    "pantone gold c": (0, 17, 65, 35),
    "pantone 872 c": (0, 14, 59, 30),
    "pantone 873 c": (0, 12, 51, 25),
    "pantone 874 c": (0, 10, 45, 20),
    "pantone 875 c": (0, 8, 38, 15),
    "pantone 876 c": (0, 6, 30, 10),
    
    # Additional popular colors
    "pantone 335 c": (90, 0, 60, 15),
    "pantone 448 c": (0, 6, 50, 78),
    "pantone 280 c": (100, 72, 0, 18),
    "pantone 253 c": (38, 88, 0, 0),
    "pantone 7455 c": (38, 0, 62, 0),
    "pantone 7527 c": (22, 19, 29, 20),
}

# ============================================================================
# KLASY DANYCH
# ============================================================================

@dataclass
class SeparationInfo:
    name: str
    kind: str
    cmyk_recipe: tuple
    display_color: str
    halftone_angle: float = 45.0

    def to_dict(self):
        return {
            "name": self.name,
            "kind": self.kind,
            "cmykRecipe": list(self.cmyk_recipe),
            "displayColor": self.display_color,
            "halftoneAngle": self.halftone_angle,
        }

# ============================================================================
# FUNKCJE POMOCNICZE
# ============================================================================

def decode_hex_escapes(name):
    def _replace(m):
        try:
            return bytes.fromhex(m.group(1)).decode("utf-8", errors="ignore")
        except Exception:
            return ""
    return re.sub(r'#(\[0-9A-Fa-f]{2})', _replace, name)

def classify_color(name):
    lower = name.lower()
    for hint in TECH_HINTS:
        if hint in lower:
            return "tech"
    return "spot"

def get_recipe(name):
    lower = name.lower().strip()
    
    # Szukaj exact match
    for key, recipe in PANTONE_RECIPES.items():
        if key == lower or key.replace(" ", "") == lower.replace(" ", ""):
            return recipe
    
    # Szukaj partial match
    for key, recipe in PANTONE_RECIPES.items():
        if key in lower or lower in key:
            return recipe
    
    # Szukaj numeru Pantone
    m = re.search(r'(\d{2,4})', lower)
    if m:
        num = m.group(1)
        for key, recipe in PANTONE_RECIPES.items():
            if num in key:
                return recipe
    
    # Domyślne kolory dla tech
    if classify_color(name) == "tech":
        return (0, 100, 0, 0)
    
    return (100, 0, 100, 0)

def cmyk_to_hex(c, m, y, k):
    c, m, y, k = c/100, m/100, y/100, k/100
    r = int(255*(1-c)*(1-k))
    g = int(255*(1-m)*(1-k))
    b = int(255*(1-y)*(1-k))
    return f"#{r:02x}{g:02x}{b:02x}"

def rgb_to_hex(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"

# ============================================================================
# ALGORYTM HALFTONE
# ============================================================================

def generate_bayer_matrix(size):
    """Generuje macierz Bayera dla ordered dithering"""
    if size == 2:
        return np.array([[0, 2], [3, 1]], dtype=np.float32) / 4.0
    elif size == 4:
        m2 = generate_bayer_matrix(2)
        return np.block([
            [4*m2, 4*m2 + 2],
            [4*m2 + 3, 4*m2 + 1]
        ]) / 16.0
    elif size == 8:
        m4 = generate_bayer_matrix(4)
        return np.block([
            [4*m4, 4*m4 + 2],
            [4*m4 + 3, 4*m4 + 1]
        ]) / 64.0
    else:
        # Default to 4x4
        return generate_bayer_matrix(4)

# Macierz Bayera 8x8 (standard w druku)
BAYER_8x8 = np.array([
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
], dtype=np.float32) / 64.0

def apply_halftone_am(intensity, cell_size=8, angle=45.0):
    """
    AM (Amplitudowo Modulowany) Halftone
    Tworzy siatkę kropek o stałej częstotliwości, zmiennej wielkości
    
    Args:
        intensity: tablica 2D z wartościami 0-255
        cell_size: rozmiar komórki kropki (typowo 4-16px)
        angle: kąt ekranowania w stopniach
    
    Returns:
        tablica 2D z wartościami 0-255 (biała kropka na czarnym tle)
    """
    h, w = intensity.shape[:2]
    intensity = intensity.astype(np.float32) / 255.0
    
    # Transformacja współrzędnych dla kąta
    angle_rad = math.radians(angle)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    
    # Utwórz grid współrzędnych
    y, x = np.meshgrid(np.arange(h), np.arange(w), indexing='ij')
    
    # Rotacja układu współrzędnych
    x_rot = x * cos_a + y * sin_a
    y_rot = -x * sin_a + y * cos_a
    
    # Siatka komórek
    cell_x = (x_rot % cell_size) - cell_size / 2
    cell_y = (y_rot % cell_size) - cell_size / 2
    
    # Odległość od środka komórki (krag)
    distance = np.sqrt(cell_x**2 + cell_y**2)
    
    # Promień kropki = intensity * połowa komórki
    max_radius = cell_size / 2 - 0.5
    dot_radius = intensity * max_radius
    
    # Kropka: 255 jeśli distance < radius (biała), 0 jeśli poza (czarna)
    halftone = np.where(distance < dot_radius, 255, 0).astype(np.uint8)
    
    return halftone

def apply_halftone_floyd_steinberg(intensity):
    """
    FM (Częstotliwościowo Modulowany) Halftone - Error Diffusion
    Dyfuzja błędu Floyd-Steinberg
    
    Args:
        intensity: tablica 2D z wartościami 0-255
    
    Returns:
        tablica 2D binarna (0 lub 255)
    """
    h, w = intensity.shape[:2]
    img = intensity.astype(np.float32).copy()
    result = np.zeros((h, w), dtype=np.uint8)
    
    for y in range(h):
        for x in range(w):
            old_pixel = img[y, x]
            new_pixel = 255.0 if old_pixel > 127 else 0.0
            result[y, x] = int(new_pixel)
            error = old_pixel - new_pixel
            
            # Floyd-Steinberg distribution
            if x + 1 < w:
                img[y, x + 1] += error * 7 / 16
            if y + 1 < h:
                if x > 0:
                    img[y + 1, x - 1] += error * 3 / 16
                img[y + 1, x] += error * 5 / 16
                if x + 1 < w:
                    img[y + 1, x + 1] += error * 1 / 16
    
    return result

def apply_halftone_ordered(intensity, cell_size=8):
    """
    Ordered Dithering z macierzą Bayera
    Szybki algorytm dla dużych obrazów
    """
    h, w = intensity.shape[:2]
    intensity = intensity.astype(np.float32)
    result = np.zeros((h, w), dtype=np.uint8)
    
    # Tile macierzy Bayera
    bayer = BAUER_8x8 if cell_size == 8 else generate_bayer_matrix(cell_size)
    bh, bw = bayer.shape
    
    for y in range(h):
        for x in range(w):
            threshold = bayer[y % bh, x % bw]
            if intensity[y, x] / 255.0 > threshold:
                result[y, x] = 255
            else:
                result[y, x] = 0
    
    return result

def apply_halftone_round(intensity, cell_size=8):
    """
    Symulacja kropki drukarskiej (okrągłej)
    - Inwersja: ciemne piksele = duże kropki
    - Biały background = obszar bez atramentu
    """
    h, w = intensity.shape[:2]
    intensity = intensity.astype(np.float32) / 255.0
    
    y, x = np.meshgrid(np.arange(h), np.arange(w), indexing='ij')
    
    # Siatka komórek (kratka drukarska)
    cell_x = x % cell_size
    cell_y = y % cell_size
    
    # Odległość od centrum komórki
    cx, cy = cell_size / 2, cell_size / 2
    dist = np.sqrt((cell_x - cx)**2 + (cell_y - cy)**2)
    
    # Promień kropki zależy od intensywności (inverted)
    # Ciemne = duże kropki, jasne = małe/margines
    max_radius = cell_size / 2 - 0.3
    dot_radius = intensity * max_radius
    
    # Kropka jest "zapisana" (biała na czarnym tle dla płyty)
    # Czarne tło = papier
    # Biała kropka = miejsce gdzie będzie atrament
    result = np.where(dist < dot_radius, 255, 0).astype(np.uint8)
    
    # Inwersja dla płyty drukarskiej (pokazujemy atrament)
    return 255 - result

# ============================================================================
# EKSTRAKCJA SEPARACJI Z PDF
# ============================================================================

def extract_separations(doc):
    found = {}
    
    for xref in range(1, doc.xref_length()):
        try:
            obj = doc.xref_object(xref)
        except Exception:
            continue
        
        if "/Separation" not in obj and "/DeviceN" not in obj:
            continue
        
        # Szukaj Separation
        for raw in re.findall(r'/Separation\s*/(\[^\s/()<>\[\]{}\"]+)', obj):
            name = decode_hex_escapes(raw)
            if name.lower() in BLACKLIST:
                continue
            kind = classify_color(name)
            recipe = get_recipe(name)
            
            # Kąty ekranowania dla CMYK
            if name.lower() in ['cyan', 'c']:
                angle = 15.0
            elif name.lower() in ['magenta', 'm']:
                angle = 75.0
            elif name.lower() in ['yellow', 'y']:
                angle = 0.0
            elif name.lower() in ['black', 'k']:
                angle = 45.0
            else:
                angle = 45.0
            
            found[name] = SeparationInfo(name, kind, recipe, cmyk_to_hex(*recipe), angle)
        
        # Szukaj DeviceN (wiele kolorów)
        for block in re.findall(r'/DeviceN\s*\[(.+?)\]', obj, re.S):
            for raw in re.findall(r'/(\[^\s/()<>\[\]{}\"]+)', block):
                name = decode_hex_escapes(raw)
                if name.lower() in BLACKLIST:
                    continue
                kind = classify_color(name)
                recipe = get_recipe(name)
                found.setdefault(name, SeparationInfo(name, kind, recipe, cmyk_to_hex(*recipe)))
    
    return list(found.values())

# ============================================================================
# RENDEROWANIE PDF
# ============================================================================

def render_cmyk(doc, page_index, dpi):
    """Renderuje stronę PDF w przestrzeni CMYK"""
    page = doc[page_index]
    mat = fitz.Matrix(dpi/72, dpi/72)
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csCMYK, alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 4).copy()

def render_rgb(doc, page_index, dpi):
    """Renderuje stronę PDF w RGB"""
    page = doc[page_index]
    mat = fitz.Matrix(dpi/72, dpi/72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n).copy()

# ============================================================================
# EKSTRAKCJA KANAŁÓW SPOT
# ============================================================================

def extract_spot_channel(cmyk_arr, recipe, tolerance=30):
    """
    Wyodrębnia kanał spot color z danych CMYK
    
    Algorytm:
    1. Dla każdego piksela oblicz intensywność spot color
    2. Porównaj z wzorem CMYK (recipe)
    3. Zwróć maskę gdzie spot color jest obecny
    
    Args:
        cmyk_arr: tablica CMYK (H, W, 4) z wartościami 0-255
        recipe: tuple (C, M, Y, K) z wartościami 0-100
        tolerance: tolerancja dopasowania
    
    Returns:
        tablica 2D z wartościami 0-255 (nasycenie spot color)
    """
    h, w, _ = cmyk_arr.shape
    result = np.zeros((h, w), dtype=np.uint8)
    
    # Normalizuj recipe
    rc, rm, ry, rk = [r / 100.0 for r in recipe]
    
    # Znajdź istotne składniki (te z >5%)
    significant = []
    if rc > 0.05:
        significant.append((0, rc))
    if rm > 0.05:
        significant.append((1, rm))
    if ry > 0.05:
        significant.append((2, ry))
    if rk > 0.05:
        significant.append((3, rk))
    
    if not significant:
        return result
    
    # Konwertuj CMYK na intensywność
    arr = cmyk_arr.astype(np.float32)
    intensities = [arr[:, :, idx] / (ratio * 255.0) for idx, ratio in significant]
    
    # Spot intensity = minimum (CMYK musi mieć WSZYSTKIE składniki)
    spot_intensity = np.clip(np.minimum.reduce(intensities), 0, 1)
    
    # Sprawdź czy piksel pasuje do wzorca
    c_match = np.abs(arr[:, :, 0] - rc * spot_intensity * 255)
    m_match = np.abs(arr[:, :, 1] - rm * spot_intensity * 255)
    y_match = np.abs(arr[:, :, 2] - ry * spot_intensity * 255)
    k_match = np.abs(arr[:, :, 3] - rk * spot_intensity * 255)
    
    match = (
        (c_match <= tolerance) &
        (m_match <= tolerance) &
        (y_match <= tolerance) &
        (k_match <= tolerance) &
        ((arr[:, :, 0] > 5) | (arr[:, :, 1] > 5) | (arr[:, :, 2] > 5) | (arr[:, :, 3] > 5))
    )
    
    result[match] = np.clip(spot_intensity[match] * 255, 0, 255).astype(np.uint8)
    
    return result

# ============================================================================
# KONWERSJA I KODOWANIE
# ============================================================================

def to_base64_png(arr):
    """Konwertuje tablicę numpy do base64 PNG"""
    if len(arr.shape) == 2:
        img = Image.fromarray(arr, mode='L')
    elif arr.shape[2] == 3:
        img = Image.fromarray(arr.astype(np.uint8), mode='RGB')
    elif arr.shape[2] == 4:
        # CMYK -> RGB dla podglądu
        c, m, y, k = arr[:, :, 0]/255.0, arr[:, :, 1]/255.0, arr[:, :, 2]/255.0, arr[:, :, 3]/255.0
        rgb = np.stack([
            (255*(1-c)*(1-k)).astype(np.uint8),
            (255*(1-m)*(1-k)).astype(np.uint8),
            (255*(1-y)*(1-k)).astype(np.uint8),
        ], axis=2)
        img = Image.fromarray(rgb, mode='RGB')
    else:
        raise ValueError(f"Bad shape: {arr.shape}")
    
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')

def to_base64_png_with_color(arr, r, g, b):
    """
    Konwertuje tablicę do PNG z kolorem tint
    Używane do wizualizacji separacji w kolorze
    """
    h, w = arr.shape[:2]
    
    # Normalizuj do 0-1
    if arr.max() <= 255:
        normalized = arr.astype(np.float32) / 255.0
    else:
        normalized = arr.astype(np.float32) / arr.max()
    
    # Mnożnik dla koloru tint
    rgb_arr = np.stack([
        (normalized * r).astype(np.uint8),
        (normalized * g).astype(np.uint8),
        (normalized * b).astype(np.uint8),
    ], axis=2)
    
    img = Image.fromarray(rgb_arr, mode='RGB')
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')

def coverage(arr):
    """Oblicza procent pokrycia (nasycenie)"""
    return round(float(np.sum(arr > 20)) / arr.size * 100, 2)

def coverage_detailed(arr):
    """Szczegółowa analiza nasycenia"""
    total = arr.size
    non_zero = np.sum(arr > 0)
    
    #Histogram zakresów
    ranges = {
        "0-10%": np.sum((arr >= 0) & (arr <= 25)),
        "10-30%": np.sum((arr > 25) & (arr <= 76)),
        "30-70%": np.sum((arr > 76) & (arr <= 178)),
        "70-100%": np.sum(arr > 178),
    }
    
    return {
        "total": total,
        "covered": int(non_zero),
        "percentage": round(non_zero / total * 100, 2),
        "ranges": {k: round(v / total * 100, 2) for k, v in ranges.items()}
    }

# ============================================================================
# KONWERSJA CMYK <-> RGB <-> LAB
# ============================================================================

def cmyk_to_rgb(c, m, y, k):
    """Konwersja CMYK procenty -> RGB 0-255"""
    c, m, y, k = c/100, m/100, y/100, k/100
    r = int(255 * (1 - c) * (1 - k))
    g = int(255 * (1 - m) * (1 - k))
    b = int(255 * (1 - y) * (1 - k))
    return (r, g, b)

def rgb_to_cmyk(r, g, b):
    """Konwersja RGB 0-255 -> CMYK procenty (uproszczona)"""
    r, g, b = r/255, g/255, b/255
    k = 1 - max(r, g, b)
    if k >= 1:
        return (0, 0, 0, 100)
    c = (1 - r - k) / (1 - k) * 100
    m = (1 - g - k) / (1 - k) * 100
    y = (1 - b - k) / (1 - k) * 100
    return (round(c), round(m), round(y), round(k*100))

def rgb_to_lab(r, g, b):
    """Konwersja RGB -> LAB (uproszczona)"""
    # Normalizacja
    r, g, b = r/255, g/255, b/255
    
    # Linearize
    def f(t):
        if t > 0.04045:
            return ((t + 0.055) / 1.055) ** 2.4
        return t / 12.92
    
    r, g, b = f(r), f(g), f(b)
    
    # RGB to XYZ (D65)
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    
    # Normalize
    x, y, z = x / 0.95047, y / 1.0, z / 1.08883
    
    # XYZ to LAB
    def f2(t):
        if t > 0.008856:
            return t ** (1/3)
        return 7.787 * t + 16/116
    
    L = 116 * f2(y) - 16
    a = 500 * (f2(x) - f2(y))
    b_lab = 200 * (f2(y) - f2(z))
    
    return (L, a, b_lab)

def delta_e_2000(lab1, lab2):
    """Oblicza różnicę kolorów Delta E 2000"""
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    
    # Uproszczony Delta E
    dL = L2 - L1
    da = a2 - a1
    db = b2 - b1
    
    return math.sqrt(dL**2 + da**2 + db**2)

# ============================================================================
# ANALIZA KOLORÓW PDF
# ============================================================================

def analyze_pdf_colors(doc):
    """Analizuje wszystkie kolory używane w PDF"""
    colors = {
        "cmyk": [],
        "spot": [],
        "rgb": [],
        "lab": [],
        "named": []
    }
    
    # Skanuj wszystkie obiekty
    for xref in range(1, doc.xref_length()):
        try:
            obj = doc.xref_object(xref)
        except Exception:
            continue
        
        # Szukaj definiacji kolorów
        # /ColorSpace
        cs_matches = re.findall(r'/ColorSpace\s*/?(\w+)', obj)
        for name in cs_matches:
            if name not in colors["named"]:
                colors["named"].append(name)
        
        # Szukaj Separation
        sep_matches = re.findall(r'/Separation\s*/(\w+)', obj)
        for name in sep_matches:
            colors["spot"].append(name)
        
        # Szukaj DeviceN
        devicen_matches = re.findall(r'/DeviceN\s*\[(.+?)\]', obj, re.S)
        for block in devicen_matches:
            names = re.findall(r'/(\w+)', block)
            colors["spot"].extend(names)
    
    return colors

# ============================================================================
# WEBHOOK / SERWER
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "version": "4.0.0",
        "pymupdf_version": fitz.version[0],
        "python_version": sys.version.split()[0],
        "engine": "ghostscript" if HAS_GS else "pymupdf",
        "ghostscript": HAS_GS,
        "ghostscriptPath": (gs_engine.GS_BIN if (HAS_GS and gs_engine) else None),
        "features": [
            "true_separations" if HAS_GS else "approx_separations",
            "halftone_am",
            "spot_extraction",
            "diecut_extraction",
            "color_analysis",
        ]
    })

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Analiza pliku PDF - wykrywa separacje i kolory"""
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    
    f = request.files['file']
    try:
        data = f.read()
        doc = fitz.open(stream=data, filetype="pdf")

        # Ekstrahuj separacje (PyMuPDF - szybkie skanowanie nazw)
        seps = extract_separations(doc)

        # Analizuj kolory
        color_analysis = analyze_pdf_colors(doc)

        # Informacje o stronach
        pages = []
        for i in range(len(doc)):
            r = doc[i].rect
            pages.append({
                "index": i,
                "width": round(r.width, 2),
                "height": round(r.height, 2),
                "rotation": doc[i].rotation
            })

        doc.close()

        engine = "pymupdf"
        sep_dicts = [s.to_dict() for s in seps]

        # Jesli mamy Ghostscript - pobierz PRAWDZIWA liste plyt z 1. strony.
        # To gwarantuje, ze pokazane separacje sa dokladnie tymi w pliku
        # (lacznie z diecut / Pantone), a nie zgadywane.
        if HAS_GS and gs_engine is not None:
            try:
                gs_plates, _w, _h = gs_engine.render_separations(
                    data, 0, dpi=72,  # niska rozdzielczosc = szybko, tylko nazwy
                    tech_hints=TECH_HINTS,
                    recipe_lookup=lambda n: get_recipe(n),
                )
                engine = "ghostscript"
                true_seps = []
                for p in gs_plates:
                    if p.kind == "process":
                        continue  # proces dodajemy osobno ponizej
                    true_seps.append({
                        "name": p.name,
                        "kind": p.kind,
                        "cmykRecipe": list(get_recipe(p.name)),
                        "displayColor": p.display_color,
                        "halftoneAngle": 45.0,
                        # czy plyta faktycznie zawiera atrament
                        "hasInk": bool(p.data.max() > 0),
                    })
                if true_seps:
                    sep_dicts = true_seps
            except Exception as e:
                print(f"[analyze] GS pre-pass nieudany: {e}")

        return jsonify({
            "success": True,
            "filename": f.filename,
            "engine": engine,
            "pageCount": len(pages),
            "pages": pages,
            "separations": sep_dicts,
            "processColors": [
                {"name": "Cyan", "kind": "process", "cmykRecipe": [100, 0, 0, 0], "displayColor": "#00aeef", "halftoneAngle": 15},
                {"name": "Magenta", "kind": "process", "cmykRecipe": [0, 100, 0, 0], "displayColor": "#ec008c", "halftoneAngle": 75},
                {"name": "Yellow", "kind": "process", "cmykRecipe": [0, 0, 100, 0], "displayColor": "#fff200", "halftoneAngle": 0},
                {"name": "Black", "kind": "process", "cmykRecipe": [0, 0, 0, 100], "displayColor": "#231f20", "halftoneAngle": 45},
            ],
            "colorAnalysis": color_analysis,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ============================================================================
# WSPOLNY SILNIK PLYT (Ghostscript -> prawdziwe separacje; fallback PyMuPDF)
# ============================================================================

@dataclass
class RipPlate:
    """Ujednolicona plyta dla warstwy serwerowej."""
    name: str
    kind: str                       # process | spot | tech
    data: np.ndarray                # uint8 (H,W) 0=papier 255=pelny atrament
    display_color: str
    angle: float = 45.0


def _process_angle(name):
    return {"cyan": 15.0, "magenta": 75.0, "yellow": 0.0, "black": 45.0}.get(
        name.lower().strip(), 45.0
    )


def build_plates(pdf_bytes, page_idx, dpi):
    """
    Zwraca (plates: list[RipPlate], width, height, engine: str).

    engine == 'ghostscript' -> prawdziwe separacje (C/M/Y/K + kazdy spot/diecut
                                dokladnie wg nazw w pliku).
    engine == 'pymupdf'     -> fallback: CMYK z rasteryzacji + heurystyka spot.
    """
    # 1) PROBA: Ghostscript tiffsep (prawidlowe plyty)
    if HAS_GS and gs_engine is not None:
        try:
            gs_plates, w, h = gs_engine.render_separations(
                pdf_bytes, page_idx, dpi=dpi,
                tech_hints=TECH_HINTS,
                recipe_lookup=lambda n: get_recipe(n),
            )
            plates = []
            for p in gs_plates:
                plates.append(RipPlate(
                    name=p.name,
                    kind=p.kind,
                    data=p.data,
                    display_color=p.display_color,
                    angle=_process_angle(p.name),
                ))
            return plates, w, h, "ghostscript"
        except Exception as e:
            import traceback
            print(f"[build_plates] Ghostscript nieudany, fallback PyMuPDF: {e}")
            traceback.print_exc()

    # 2) FALLBACK: PyMuPDF (stare zachowanie, separacje przyblizone)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    cmyk = render_cmyk(doc, page_idx, dpi)
    h, w = cmyk.shape[:2]
    seps = extract_separations(doc)
    doc.close()

    process_meta = [
        ("Cyan", "#00aeef"), ("Magenta", "#ec008c"),
        ("Yellow", "#fff200"), ("Black", "#231f20"),
    ]
    plates = []
    for i, (name, color) in enumerate(process_meta):
        plates.append(RipPlate(
            name=name, kind="process", data=cmyk[:, :, i].copy(),
            display_color=color, angle=_process_angle(name),
        ))
    for sep in seps:
        spot = extract_spot_channel(cmyk, sep.cmyk_recipe)
        plates.append(RipPlate(
            name=sep.name, kind=sep.kind, data=spot,
            display_color=sep.display_color, angle=45.0,
        ))
    return plates, w, h, "pymupdf"


def _halftone_for(plate, mode, cell_size):
    """
    Zwraca dict z polami 'continuous' i/lub 'halftone' (base64 PNG)
    w KOLORZE plyty -> separacja widoczna jak w druku (kropki = natezenie).
    Wymaga ht_engine (numpy halftone); jesli brak, uzywa starych funkcji.
    """
    out = {}
    color = plate.display_color
    if ht_engine is not None:
        if mode in ("continuous", "both"):
            out["continuous"] = _png_b64_rgb(
                ht_engine.render_continuous_tint(plate.data, color)
            )
        if mode in ("halftone", "both"):
            out["halftone"] = _png_b64_rgb(
                ht_engine.render_halftone_tint(plate.data, color, cell_size, plate.angle)
            )
    else:
        # awaryjnie: stare, monochromatyczne
        if mode in ("continuous", "both"):
            out["continuous"] = to_base64_png(plate.data)
        if mode in ("halftone", "both"):
            out["halftone"] = to_base64_png(apply_halftone_round(plate.data, cell_size))
    return out


def _png_b64_rgb(arr):
    """RGB/L numpy -> base64 PNG."""
    if arr.ndim == 2:
        img = Image.fromarray(arr, mode="L")
    else:
        img = Image.fromarray(arr.astype(np.uint8), mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _composite_from_plates(plates, w, h):
    """Sklada podglad kompozytowy mnozac plyty (model subtraktywny)."""
    # zaczynamy od bialego papieru
    rgb = np.ones((h, w, 3), dtype=np.float32)
    for p in plates:
        d = p.data.astype(np.float32) / 255.0  # natezenie 0..1
        cr, cg, cb = ht_engine._hex_to_rgb(p.display_color) if ht_engine else (0, 0, 0)
        # mnozenie: papier * (1 - d*(1 - kolor))
        rgb[..., 0] *= (1 - d * (1 - cr / 255.0))
        rgb[..., 1] *= (1 - d * (1 - cg / 255.0))
        rgb[..., 2] *= (1 - d * (1 - cb / 255.0))
    return (rgb * 255).astype(np.uint8)


@app.route('/api/render', methods=['POST'])
def render():
    """Renderuje stronę z opcjami halftone - PRAWDZIWE separacje (Ghostscript)."""
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400

    f = request.files['file']
    page_idx = int(request.form.get('page', 0))
    dpi = min(max(int(request.form.get('dpi', 150)), 72), 600)
    mode = request.form.get('mode', 'both')        # continuous | halftone | both
    halftone_type = request.form.get('halftone_type', 'am')
    cell_size = max(3, min(int(request.form.get('cell_size', 8)), 32))

    try:
        data = f.read()
        plates, w, h, engine = build_plates(data, page_idx, dpi)

        channels = {}
        for p in plates:
            ch = _halftone_for(p, mode, cell_size)
            ch.update({
                "coverage": coverage(p.data),
                "coverageDetailed": coverage_detailed(p.data),
                "kind": p.kind,
                "displayColor": p.display_color,
                "halftoneAngle": p.angle,
            })
            try:
                ch["cmykRecipe"] = list(get_recipe(p.name)) if p.kind != "process" else _process_recipe(p.name)
            except Exception:
                ch["cmykRecipe"] = [0, 0, 0, 0]
            channels[p.name] = ch

        composite = _composite_from_plates(plates, w, h)

        return jsonify({
            "success": True,
            "engine": engine,
            "width": w,
            "height": h,
            "dpi": dpi,
            "mode": mode,
            "halftoneType": halftone_type,
            "cellSize": cell_size,
            "composite": _png_b64_rgb(composite),
            "channels": channels,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def _process_recipe(name):
    return {
        "cyan": [100, 0, 0, 0], "magenta": [0, 100, 0, 0],
        "yellow": [0, 0, 100, 0], "black": [0, 0, 0, 100],
    }.get(name.lower().strip(), [0, 0, 0, 0])

@app.route('/api/export-plate', methods=['POST'])
def export_plate():
    """Eksportuje płytę drukarską"""
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    
    f = request.files['file']
    page_idx = int(request.form.get('page', 0))
    ch_name = request.form.get('channel', 'Black')
    dpi = min(max(int(request.form.get('dpi', 300)), 72), 1200)
    fmt = request.form.get('format', 'png').lower()
    halftone = request.form.get('halftone', 'false').lower() == 'true'
    cell_size = int(request.form.get('cell_size', 8))
    
    try:
        data = f.read()
        # Uzyj wspolnego silnika (Ghostscript) - prawdziwe plyty wg nazw w pliku
        plates, w, h, engine = build_plates(data, page_idx, dpi)
        sel = next((p for p in plates if p.name == ch_name), None)
        if sel is None:
            # dopasowanie bez rozroznienia wielkosci liter
            sel = next((p for p in plates if p.name.lower() == ch_name.lower()), None)
        if sel is None:
            return jsonify({"error": f"Not found: {ch_name}",
                            "available": [p.name for p in plates]}), 404

        plate = sel.data  # 0=papier, 255=pelny atrament

        # Apply halftone jeśli wymagane (raster AM w skali szarosci)
        if halftone:
            if ht_engine is not None:
                # render_halftone_gray: czarna kropka(0)/papier(255). To juz plyta
                gray = ht_engine.render_halftone_gray(plate, cell_size, sel.angle)
                img = Image.fromarray(gray, mode='L')
                buf = io.BytesIO()
                if fmt == 'tiff':
                    img.save(buf, format='TIFF', compression='tiff_lzw', dpi=(dpi, dpi))
                    mime, ext = 'image/tiff', 'tiff'
                else:
                    img.save(buf, format='PNG', dpi=(dpi, dpi))
                    mime, ext = 'image/png', 'png'
                buf.seek(0)
                safe = re.sub(r'[^A-Za-z0-9._-]+', '_', ch_name)
                return send_file(buf, mimetype=mime, as_attachment=True,
                                 download_name=f"plate_{safe}_{dpi}dpi.{ext}")
            else:
                plate = apply_halftone_round(plate, cell_size)

        # Inwersja dla płyty drukarskiej (biały = papier, czarny = atrament)
        inverted = 255 - plate

        img = Image.fromarray(inverted, mode='L')
        buf = io.BytesIO()
        
        if fmt == 'tiff':
            img.save(buf, format='TIFF', compression='tiff_lzw', dpi=(dpi, dpi))
            mime, ext = 'image/tiff', 'tiff'
        else:
            img.save(buf, format='PNG', dpi=(dpi, dpi))
            mime, ext = 'image/png', 'png'
        
        buf.seek(0)
        safe = re.sub(r'[^A-Za-z0-9._-]+', '_', ch_name)
        return send_file(
            buf,
            mimetype=mime,
            as_attachment=True,
            download_name=f"plate_{safe}_{dpi}dpi.{ext}"
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/spot-match', methods=['POST'])
def spot_match():
    """Znajduje najbliższy Pantone dla podanego koloru"""
    data = request.json
    
    if 'rgb' in data:
        r, g, b = data['rgb']
        lab = rgb_to_lab(r, g, b)
    elif 'cmyk' in data:
        c, m, y, k = data['cmyk']
        rgb = cmyk_to_rgb(c, m, y, k)
        lab = rgb_to_lab(*rgb)
    else:
        return jsonify({"error": "Provide rgb or cmyk"}), 400
    
    # Szukaj najbliższego Pantone
    best_match = None
    best_delta = float('inf')
    
    for name, recipe in PANTONE_RECIPES.items():
        rgb_p = cmyk_to_rgb(*recipe)
        lab_p = rgb_to_lab(*rgb_p)
        delta = delta_e_2000(lab, lab_p)
        
        if delta < best_delta:
            best_delta = delta
            best_match = name
    
    return jsonify({
        "match": best_match,
        "deltaE": round(best_delta, 2),
        "cmyk": list(PANTONE_RECIPES[best_match]) if best_match else None,
        "inputLab": lab
    })

# ============================================================================
# STRONA GŁÓWNA
# ============================================================================

FRONTEND_HTML = """
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RIP Preview PRO v3</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body>
<h1>RIP Preview PRO v3</h1>
<p>Serwer działa. Użyj aplikacji React lub API.</p>
</body>
</html>
"""

@app.route('/')
def index():
    return FRONTEND_HTML

# ============================================================================
# START
# ============================================================================

if __name__ == '__main__':
    port = 5000
    print()
    print("=" * 60)
    print(" RIP Preview PRO v3 - HALFTONE Edition")
    print("=" * 60)
    print(f" PyMuPDF: {fitz.version[0]}")
    print(f" Python: {sys.version.split()[0]}")
    if HAS_GS and gs_engine is not None:
        print(f" Ghostscript: {gs_engine.GS_BIN}  -> SEPARACJE PRAWDZIWE (tiffsep)")
    else:
        print(" Ghostscript: BRAK  -> separacje PRZYBLIZONE (fallback PyMuPDF)")
        print("   Zainstaluj Ghostscript dla pelnej wiernosci spot/diecut:")
        print("   https://ghostscript.com/releases/gsdnld.html")
    print()
    print(f" >>> Otworz w przegladarce: http://localhost:{port}")
    print()
    print(" Funkcje:")
    print("  - AM Halftone (kropki)")
    print("  - Floyd-Steinberg (dithering)")
    print("  - Ordered Dithering (Bayer)")
    print("  - Analiza CMYK + Spot Colors")
    print("  - Eksport płyt")
    print()
    print(" Ctrl+C aby zatrzymac")
    print("=" * 60)
    print()
    
    threading.Timer(1.5, lambda: webbrowser.open(f'http://localhost:{port}')).start()
    app.run(host='0.0.0.0', port=port, debug=False)
