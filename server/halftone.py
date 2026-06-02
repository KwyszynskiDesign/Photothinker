#!/usr/bin/env python3
"""
halftone.py - Symulacja rastra AM (Amplitude Modulated) jak w prawdziwym RIP.

Wejscie: tablica "ink density" uint8 (H,W), 0=papier, 255=pelny atrament.
Wyjscie zalezne od funkcji:
  - render_continuous_tint  : ciagly ton w kolorze plyty (RGB) na bialym tle
  - render_halftone_tint    : raster AM (okragle kropki) w kolorze plyty (RGB)
  - render_halftone_gray    : raster AM w skali szarosci (czarne kropki, bialy papier)

Klasyczny raster offsetowy: wielkosc kropki rosnie wraz z natezeniem koloru.
Katy ekranowania: C=15, M=75, Y=0, K=45 (domyslnie).
"""

from __future__ import annotations
import math
import numpy as np


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def am_dot_mask(
    density: np.ndarray,
    cell_size: int = 8,
    angle: float = 45.0,
) -> np.ndarray:
    """
    Zwraca maske kropek 0..1 (1 = atrament/kropka, 0 = papier).
    Wielkosc okraglej kropki proporcjonalna do natezenia (density).

    density: uint8 (H,W) 0..255  (0=papier, 255=pelny atrament)
    """
    h, w = density.shape[:2]
    d = density.astype(np.float32) / 255.0

    rad = math.radians(angle)
    cos_a, sin_a = math.cos(rad), math.sin(rad)

    yy, xx = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")

    # obrot ukladu wspolrzednych -> kat ekranowania
    xr = xx * cos_a + yy * sin_a
    yr = -xx * sin_a + yy * cos_a

    # pozycja wewnatrz komorki rastra, wycentrowana
    cx = (xr % cell_size) - cell_size / 2.0
    cy = (yr % cell_size) - cell_size / 2.0
    dist = np.sqrt(cx * cx + cy * cy)

    # promien kropki: 0 dla density=0, pelna komorka dla density=1
    # skala tak, by ~100% density wypelnialo komorke (lekkie nasycenie rogow)
    max_radius = (cell_size / 2.0) * math.sqrt(2) * 0.92
    dot_radius = np.sqrt(d) * max_radius  # sqrt -> percepcyjnie liniowy przyrost pola

    mask = (dist <= dot_radius).astype(np.float32)
    return mask


def render_continuous_tint(density: np.ndarray, hex_color: str) -> np.ndarray:
    """Ciagly ton: kolor plyty zmieszany z bialym papierem wg natezenia. -> RGB uint8."""
    h, w = density.shape[:2]
    d = density.astype(np.float32) / 255.0
    r, g, b = _hex_to_rgb(hex_color)
    paper = 255.0
    out = np.empty((h, w, 3), dtype=np.uint8)
    out[..., 0] = (paper * (1 - d) + r * d).astype(np.uint8)
    out[..., 1] = (paper * (1 - d) + g * d).astype(np.uint8)
    out[..., 2] = (paper * (1 - d) + b * d).astype(np.uint8)
    return out


def render_halftone_tint(
    density: np.ndarray, hex_color: str, cell_size: int = 8, angle: float = 45.0
) -> np.ndarray:
    """Raster AM w kolorze plyty na bialym papierze. -> RGB uint8."""
    mask = am_dot_mask(density, cell_size, angle)
    h, w = density.shape[:2]
    r, g, b = _hex_to_rgb(hex_color)
    out = np.full((h, w, 3), 255, dtype=np.uint8)
    out[..., 0] = np.where(mask > 0, r, 255)
    out[..., 1] = np.where(mask > 0, g, 255)
    out[..., 2] = np.where(mask > 0, b, 255)
    return out


def render_halftone_gray(
    density: np.ndarray, cell_size: int = 8, angle: float = 45.0
) -> np.ndarray:
    """Raster AM w skali szarosci: czarne kropki, bialy papier. -> L uint8."""
    mask = am_dot_mask(density, cell_size, angle)
    out = np.where(mask > 0, 0, 255).astype(np.uint8)  # kropka=czarna
    return out


def render_continuous_gray(density: np.ndarray) -> np.ndarray:
    """Ciagly ton w szarosci: 255=papier, 0=pelny atrament. -> L uint8."""
    return (255 - density).astype(np.uint8)
