#!/usr/bin/env python3
"""
RIP Preview PRO v2 - Serwer separacji PDF

UZYCIE:
  Przeciagnij ten plik na cmd.exe
  lub w cmd wpisz:  python rip_server.py

Sam zainstaluje potrzebne pakiety przy pierwszym uruchomieniu.
"""

import subprocess
import sys
import os

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
        print("  PIERWSZA INSTALACJA - pobieram pakiety...")
        print("  To moze potrwac 1-3 minuty.")
        print("=" * 55)
        print()
        for pkg in missing:
            print(f"  Instaluje: {pkg} ...")
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", pkg],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
            print(f"  OK: {pkg}")
        print()
        print("  Wszystkie pakiety zainstalowane!")
        print()

try:
    install_packages()
except Exception as e:
    print(f"\n  BLAD INSTALACJI: {e}")
    print(f"  Sprobuj recznie: {sys.executable} -m pip install PyMuPDF flask flask-cors Pillow numpy")
    input("\n  Nacisnij Enter aby zamknac...")
    sys.exit(1)

# ============================================================================
# IMPORTY (po instalacji)
# ============================================================================

import io
import re
import base64
import webbrowser
import threading
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# ============================================================================
# KONFIGURACJA FLASK
# ============================================================================

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

PANTONE_RECIPES = {
    "pantone 185 c": (0,91,76,0), "pantone 186 c": (0,100,81,4),
    "pantone 199 c": (0,85,44,0), "pantone 200 c": (0,100,65,15),
    "pantone 032 c": (0,90,86,0), "pantone red 032 c": (0,90,86,0),
    "pantone 021 c": (0,53,100,0), "pantone orange 021 c": (0,53,100,0),
    "pantone 116 c": (0,14,100,0), "pantone yellow 012 c": (0,2,100,0),
    "pantone 348 c": (85,0,77,28), "pantone 354 c": (82,0,100,0),
    "pantone 355 c": (91,0,100,0), "pantone green c": (95,0,100,0),
    "pantone 286 c": (100,66,0,2), "pantone 287 c": (100,68,0,12),
    "pantone 288 c": (100,67,0,23), "pantone 072 c": (100,85,5,0),
    "pantone blue 072 c": (100,85,5,0),
    "pantone 300 c": (100,44,0,0), "pantone 301 c": (100,45,0,18),
    "pantone 485 c": (0,95,100,0), "pantone 877 c": (0,0,0,30),
    "pantone silver c": (0,0,0,30), "pantone 871 c": (0,17,65,35),
    "pantone gold c": (0,17,65,35), "pantone warm red c": (0,75,90,0),
    "pantone rubine red c": (0,100,15,4),
    "pantone rhodamine red c": (0,82,0,0),
    "pantone purple c": (55,100,0,0), "pantone violet c": (90,100,0,0),
    "pantone reflex blue c": (100,73,0,2),
    "pantone process blue c": (100,10,0,10),
    "pantone 179 c": (0,79,100,0), "pantone 1788 c": (0,84,87,0),
    "pantone 1795 c": (0,94,100,0), "pantone 1797 c": (0,87,82,10),
    "pantone 109 c": (0,3,100,0), "pantone 123 c": (0,24,94,0),
    "pantone 130 c": (0,30,100,0), "pantone 151 c": (0,48,95,0),
    "pantone 158 c": (0,55,100,0), "pantone 165 c": (0,60,100,0),
    "pantone 172 c": (0,65,100,0), "pantone 219 c": (0,100,12,0),
    "pantone 226 c": (0,100,24,0), "pantone 253 c": (38,88,0,0),
    "pantone 266 c": (55,80,0,0), "pantone 267 c": (60,90,0,0),
    "pantone 280 c": (100,72,0,18), "pantone 293 c": (100,56,0,0),
    "pantone 297 c": (56,6,0,0), "pantone 306 c": (76,0,3,0),
    "pantone 311 c": (84,0,15,0), "pantone 320 c": (100,0,31,0),
    "pantone 327 c": (100,0,46,20), "pantone 335 c": (90,0,60,15),
    "pantone 368 c": (52,0,100,0), "pantone 375 c": (34,0,100,0),
    "pantone 376 c": (44,0,100,0), "pantone 382 c": (18,0,100,0),
    "pantone 389 c": (7,0,69,0), "pantone 396 c": (5,0,100,0),
    "pantone 419 c": (0,0,0,90), "pantone 425 c": (0,0,0,70),
    "pantone 429 c": (0,0,0,32), "pantone 431 c": (0,0,0,52),
    "pantone 448 c": (0,6,50,78),
    "pantone black c": (0,0,0,100), "pantone black 6 c": (100,0,0,100),
    "pantone black 7 c": (0,0,0,90),
}

# ============================================================================
# DATA CLASS
# ============================================================================

@dataclass
class SeparationInfo:
    name: str
    kind: str
    cmyk_recipe: tuple
    display_color: str

    def to_dict(self):
        return {
            "name": self.name,
            "kind": self.kind,
            "cmykRecipe": list(self.cmyk_recipe),
            "displayColor": self.display_color,
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
    return re.sub(r'#([0-9A-Fa-f]{2})', _replace, name)

def classify_color(name):
    lower = name.lower()
    for hint in TECH_HINTS:
        if hint in lower:
            return "tech"
    return "spot"

def get_recipe(name):
    lower = name.lower().strip()
    for key, recipe in PANTONE_RECIPES.items():
        if key in lower or lower in key:
            return recipe
    m = re.search(r'(\d{2,4})', lower)
    if m:
        num = m.group(1)
        for key, recipe in PANTONE_RECIPES.items():
            if num in key:
                return recipe
    if classify_color(name) == "tech":
        return (0, 100, 0, 0)
    return (100, 0, 100, 0)

def cmyk_to_hex(c, m, y, k):
    c, m, y, k = c/100, m/100, y/100, k/100
    r = int(255*(1-c)*(1-k))
    g = int(255*(1-m)*(1-k))
    b = int(255*(1-y)*(1-k))
    return f"#{r:02x}{g:02x}{b:02x}"

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

        for raw in re.findall(r'/Separation\s*/([^\s/()<>\[\]{}]+)', obj):
            name = decode_hex_escapes(raw)
            if name.lower() in BLACKLIST:
                continue
            kind = classify_color(name)
            recipe = get_recipe(name)
            found[name] = SeparationInfo(name, kind, recipe, cmyk_to_hex(*recipe))

        for block in re.findall(r'/DeviceN\s*\[(.*?)\]', obj, re.S):
            for raw in re.findall(r'/([^\s/()<>\[\]{}]+)', block):
                name = decode_hex_escapes(raw)
                if name.lower() in BLACKLIST:
                    continue
                kind = classify_color(name)
                recipe = get_recipe(name)
                found.setdefault(name, SeparationInfo(name, kind, recipe, cmyk_to_hex(*recipe)))

    return list(found.values())

# ============================================================================
# RENDEROWANIE
# ============================================================================

def render_cmyk(doc, page_index, dpi):
    page = doc[page_index]
    mat = fitz.Matrix(dpi/72, dpi/72)
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csCMYK, alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 4).copy()

def extract_spot(cmyk_arr, recipe, tolerance=35):
    h, w, _ = cmyk_arr.shape
    result = np.zeros((h, w), dtype=np.uint8)
    rc, rm, ry, rk = [r/100.0 for r in recipe]
    arr = cmyk_arr.astype(np.float32)

    significant = []
    if rc > 0.05: significant.append((0, rc))
    if rm > 0.05: significant.append((1, rm))
    if ry > 0.05: significant.append((2, ry))
    if rk > 0.05: significant.append((3, rk))
    if not significant:
        return result

    intensities = [arr[:,:,idx]/(ratio*255.0) for idx, ratio in significant]
    intensity = np.clip(np.minimum.reduce(intensities), 0, 1)

    match = (
        (np.abs(arr[:,:,0] - rc*intensity*255) <= tolerance) &
        (np.abs(arr[:,:,1] - rm*intensity*255) <= tolerance) &
        (np.abs(arr[:,:,2] - ry*intensity*255) <= tolerance) &
        (np.abs(arr[:,:,3] - rk*intensity*255) <= tolerance) &
        ((arr[:,:,0]>5)|(arr[:,:,1]>5)|(arr[:,:,2]>5)|(arr[:,:,3]>5))
    )
    result[match] = np.clip(intensity[match]*255, 0, 255).astype(np.uint8)
    return result

def to_base64_png(arr):
    if len(arr.shape) == 2:
        img = Image.fromarray(arr, mode='L')
    elif arr.shape[2] == 3:
        img = Image.fromarray(arr, mode='RGB')
    elif arr.shape[2] == 4:
        c, m, y, k = arr[:,:,0]/255.0, arr[:,:,1]/255.0, arr[:,:,2]/255.0, arr[:,:,3]/255.0
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

def coverage(arr):
    return round(float(np.sum(arr)) / (arr.size * 255) * 100, 2)

# ============================================================================
# WBUDOWANY FRONTEND HTML
# ============================================================================

FRONTEND_HTML = r"""<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RIP Preview PRO v2</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;overflow:hidden;height:100vh}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#1e293b}::-webkit-scrollbar-thumb{background:#475569;border-radius:3px}

.header{display:flex;align-items:center;gap:12px;padding:8px 16px;background:#0f172aee;border-bottom:1px solid #334155;height:48px}
.header h1{font-size:14px;font-weight:700;color:#fff}
.header .dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0}
.header .info{font-size:11px;color:#64748b}

.main{display:flex;height:calc(100vh - 48px)}

.sidebar{width:280px;border-right:1px solid #1e293b;background:#111827;overflow-y:auto;flex-shrink:0;padding:12px}
.sidebar h3{font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin:16px 0 8px;display:flex;align-items:center;gap:6px}
.sidebar h3:first-child{margin-top:4px}

.ch-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;border:1px solid #1e293b;margin-bottom:6px;cursor:pointer;transition:.15s}
.ch-item:hover{background:#1e293b}
.ch-item.selected{border-color:#0891b2;background:#164e63}
.ch-item .swatch{width:16px;height:16px;border-radius:3px;border:1px solid #ffffff20;flex-shrink:0}
.ch-item .name{font-size:12px;font-weight:500;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-item .badge{font-size:9px;padding:1px 6px;border-radius:4px;flex-shrink:0}
.badge.process{background:#1e3a5f;color:#60a5fa}
.badge.spot{background:#4a2400;color:#fb923c}
.badge.tech{background:#064e3b;color:#34d399}
.ch-item .cov{font-size:10px;color:#64748b;font-family:monospace;flex-shrink:0}
.ch-item .eye{width:18px;height:18px;cursor:pointer;opacity:.5;flex-shrink:0;filter:invert(1)}
.ch-item .eye.on{opacity:1}

.content{flex:1;display:flex;flex-direction:column;overflow:hidden}

.tabs{display:flex;gap:4px;padding:8px 12px;background:#0f172a;border-bottom:1px solid #1e293b}
.tab{padding:6px 14px;font-size:11px;border-radius:6px;cursor:pointer;color:#94a3b8;border:none;background:none;font-weight:500}
.tab:hover{background:#1e293b;color:#fff}
.tab.active{background:#0891b2;color:#fff}

.canvas-wrap{flex:1;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#1a1a2e 0% 25%,#151525 0% 50%) 0 0/20px 20px}
.canvas-wrap canvas{max-width:95%;max-height:95%;object-fit:contain}
.canvas-wrap .loading{position:absolute;inset:0;background:#0f172aDD;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px}
.spinner{width:32px;height:32px;border:3px solid #334155;border-top:3px solid #22d3ee;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.upload-zone{border:2px dashed #334155;border-radius:16px;padding:60px 40px;text-align:center;max-width:500px;margin:auto;cursor:pointer;transition:.2s}
.upload-zone:hover{border-color:#0891b2;background:#0891b210}
.upload-zone h2{color:#fff;font-size:18px;margin-bottom:8px}
.upload-zone p{color:#64748b;font-size:13px}

.info-panel{padding:24px;overflow-y:auto;height:100%}
.info-panel h2{font-size:18px;color:#fff;margin-bottom:16px}
.info-card{background:#1e293b;border-radius:10px;padding:16px;margin-bottom:12px;border:1px solid #334155}
.info-card .label{font-size:10px;color:#64748b;text-transform:uppercase}
.info-card .value{font-size:14px;color:#fff;margin-top:2px}

.bar{height:6px;background:#334155;border-radius:3px;overflow:hidden;margin-top:4px}
.bar div{height:100%;border-radius:3px;transition:width .3s}

#fileInput{display:none}
.export-btn{width:100%;padding:8px;font-size:11px;border:none;border-radius:8px;cursor:pointer;margin-top:4px;font-weight:500}
.export-btn.primary{background:#0891b2;color:#fff}.export-btn.primary:hover{background:#06b6d4}
.export-btn.secondary{background:#334155;color:#cbd5e1}.export-btn.secondary:hover{background:#475569}

.notice{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px;font-size:11px;color:#94a3b8;margin-top:12px}
</style>
</head>
<body>

<div class="header">
  <div class="dot" id="statusDot"></div>
  <h1>RIP Preview PRO v2</h1>
  <span class="info" id="serverInfo">PyMuPDF</span>
  <span class="info" id="fileInfo" style="margin-left:auto"></span>
  <span class="info" id="sizeInfo"></span>
</div>

<div class="main">
  <div class="sidebar" id="sidebar" style="display:none">
    <!-- channels go here dynamically -->
  </div>
  <div class="content">
    <div class="tabs" id="tabBar" style="display:none">
      <button class="tab active" data-tab="composite">Composite</button>
      <button class="tab" data-tab="plate">Plate</button>
      <button class="tab" data-tab="info">Info</button>
    </div>
    <div class="canvas-wrap" id="canvasWrap">
      <!-- upload or canvas -->
      <div id="uploadArea">
        <div class="upload-zone" onclick="document.getElementById('fileInput').click()">
          <h2>Wgraj plik PDF</h2>
          <p>Przeciagnij lub kliknij aby wybrac<br>Obsluga CMYK, Pantone, diecut</p>
        </div>
        <input type="file" id="fileInput" accept=".pdf">
      </div>
    </div>
  </div>
</div>

<script>
const API = '';  // same origin
let currentFile = null;
let channels = {};     // name -> {image, coverage, kind, recipe, color}
let separations = [];
let selectedChannel = '';
let enabledChannels = {};
let compositeB64 = '';
let currentTab = 'composite';

// ---- DOM refs ----
const sidebar      = document.getElementById('sidebar');
const tabBar       = document.getElementById('tabBar');
const canvasWrap   = document.getElementById('canvasWrap');
const uploadArea   = document.getElementById('uploadArea');
const fileInput    = document.getElementById('fileInput');
const fileInfo     = document.getElementById('fileInfo');
const sizeInfo     = document.getElementById('sizeInfo');
const serverInfo   = document.getElementById('serverInfo');
const statusDot    = document.getElementById('statusDot');

// ---- Health check ----
fetch(API+'/api/health').then(r=>r.json()).then(d=>{
  statusDot.style.background='#22c55e';
  serverInfo.textContent='PyMuPDF '+d.pymupdf_version+' | Server online';
}).catch(()=>{
  statusDot.style.background='#ef4444';
  serverInfo.textContent='Server offline!';
});

// ---- File upload ----
fileInput.addEventListener('change', e => {
  if(e.target.files[0]) loadFile(e.target.files[0]);
});
// drag & drop
canvasWrap.addEventListener('dragover', e=>{e.preventDefault()});
canvasWrap.addEventListener('drop', e=>{
  e.preventDefault();
  if(e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});

async function loadFile(file){
  currentFile = file;
  fileInfo.textContent = file.name;
  showLoading('Analiza PDF...');

  try {
    // Analyze
    let fd = new FormData();
    fd.append('file', file);
    let res = await fetch(API+'/api/analyze', {method:'POST', body:fd});
    let data = await res.json();
    if(!data.success) throw new Error(data.error);

    separations = [...data.processColors, ...data.separations];
    enabledChannels = {};
    separations.forEach(s => enabledChannels[s.name] = true);
    selectedChannel = '';

    // Render
    await renderPage(file, 0, 150);

    sidebar.style.display = '';
    tabBar.style.display = '';
    uploadArea.style.display = 'none';
    buildSidebar();
    switchTab('composite');
  } catch(err) {
    alert('Blad: ' + err.message);
    hideLoading();
  }
}

async function renderPage(file, page, dpi){
  showLoading('Renderowanie CMYK...');
  let fd = new FormData();
  fd.append('file', file);
  fd.append('page', page);
  fd.append('dpi', dpi);
  let res = await fetch(API+'/api/render', {method:'POST', body:fd});
  let data = await res.json();
  if(!data.success) throw new Error(data.error);

  compositeB64 = data.composite;
  channels = {};
  for(let [name, ch] of Object.entries(data.channels)){
    let sep = separations.find(s=>s.name===name) || {};
    channels[name] = {
      image: ch.image,
      coverage: ch.coverage,
      kind: sep.kind || 'process',
      recipe: sep.cmykRecipe || [0,0,0,0],
      color: sep.displayColor || '#888',
    };
  }
  sizeInfo.textContent = data.width+'x'+data.height+' @'+data.dpi+'dpi';
  hideLoading();
}

// ---- Sidebar ----
function buildSidebar(){
  let html = '';
  const groups = [
    {title:'CMYK Process', filter: s=>s.kind==='process'},
    {title:'Spot Colors',  filter: s=>s.kind==='spot'},
    {title:'Technical',    filter: s=>s.kind==='tech'},
  ];
  for(let g of groups){
    let items = separations.filter(g.filter);
    if(!items.length) continue;
    html += `<h3>${g.title} (${items.length})</h3>`;
    for(let s of items){
      let ch = channels[s.name] || {};
      let sel = selectedChannel===s.name ? 'selected' : '';
      html += `
        <div class="ch-item ${sel}" onclick="selectChannel('${esc(s.name)}')">
          <div class="swatch" style="background:${s.displayColor}"></div>
          <span class="name">${esc(s.name)}</span>
          <span class="badge ${s.kind}">${s.kind}</span>
          <span class="cov">${(ch.coverage||0).toFixed(1)}%</span>
        </div>`;
    }
  }

  // export buttons
  html += `<h3>Export</h3>`;
  html += `<button class="export-btn primary" onclick="exportComposite()">Export Composite PNG</button>`;
  if(selectedChannel){
    html += `<button class="export-btn secondary" onclick="exportPlate('${esc(selectedChannel)}')">Export "${esc(selectedChannel)}" 300dpi</button>`;
  }
  html += `<div class="notice">Serwer renderuje CMYK natywnie przez PyMuPDF.<br>Czarny = kanal K, nie rozbity na CMY.</div>`;
  sidebar.innerHTML = html;
}

function esc(s){ return s.replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function selectChannel(name){
  selectedChannel = name;
  buildSidebar();
  if(currentTab==='composite') switchTab('plate');
  else showChannel(name);
}

// ---- Tabs ----
tabBar.addEventListener('click', e=>{
  if(e.target.classList.contains('tab')){
    switchTab(e.target.dataset.tab);
  }
});

function switchTab(tab){
  currentTab = tab;
  tabBar.querySelectorAll('.tab').forEach(t=>{
    t.classList.toggle('active', t.dataset.tab===tab);
  });
  if(tab==='composite') showComposite();
  else if(tab==='plate') showChannel(selectedChannel);
  else if(tab==='info') showInfo();
}

// ---- Display ----
function showComposite(){
  if(!compositeB64) return;
  showImage(compositeB64);
}

function showChannel(name){
  if(!name || !channels[name]) return;
  showImage(channels[name].image);
}

function showImage(b64){
  let existing = canvasWrap.querySelector('canvas');
  if(!existing){
    existing = document.createElement('canvas');
    canvasWrap.appendChild(existing);
  }
  let img = new window.Image();
  img.onload = ()=>{
    existing.width = img.width;
    existing.height = img.height;
    existing.getContext('2d').drawImage(img,0,0);
  };
  img.src = 'data:image/png;base64,'+b64;
}

function showInfo(){
  let html = '<div class="info-panel">';
  html += '<h2>Separations</h2>';
  for(let [name, ch] of Object.entries(channels)){
    html += `<div class="info-card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:20px;height:20px;border-radius:4px;background:${ch.color};border:1px solid #fff2"></div>
        <span style="font-size:13px;font-weight:600">${esc(name)}</span>
        <span class="badge ${ch.kind}" style="margin-left:auto">${ch.kind}</span>
      </div>
      <div class="label">Coverage</div>
      <div class="value">${ch.coverage.toFixed(2)}%</div>
      <div class="bar"><div style="width:${Math.min(100,ch.coverage)}%;background:${ch.color}"></div></div>
    </div>`;
  }
  let tic = Object.values(channels).reduce((a,c)=>a+c.coverage,0);
  html += `<div class="info-card"><div class="label">Total Ink Coverage</div><div class="value">${tic.toFixed(1)}%</div>`;
  if(tic>300) html += `<div style="color:#fbbf24;font-size:12px;margin-top:4px">⚠ TIC przekracza 300%</div>`;
  html += '</div></div>';

  // replace canvas area content
  let existing = canvasWrap.querySelector('.info-panel');
  if(existing) existing.remove();
  existing = canvasWrap.querySelector('canvas');
  if(existing) existing.style.display='none';

  let div = document.createElement('div');
  div.innerHTML = html;
  div.firstElementChild.style.width='100%';
  canvasWrap.appendChild(div.firstElementChild);
}

// ---- Export ----
function exportComposite(){
  if(!compositeB64) return;
  let a = document.createElement('a');
  a.href = 'data:image/png;base64,'+compositeB64;
  a.download = 'composite.png';
  a.click();
}

async function exportPlate(name){
  if(!currentFile) return;
  showLoading('Eksport plate 300dpi...');
  try {
    let fd = new FormData();
    fd.append('file', currentFile);
    fd.append('page', '0');
    fd.append('channel', name);
    fd.append('dpi', '300');
    fd.append('format', 'png');
    let res = await fetch(API+'/api/export-plate', {method:'POST', body:fd});
    let blob = await res.blob();
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url; a.download = 'plate_'+name.replace(/[^a-zA-Z0-9]/g,'_')+'.png';
    a.click();
    URL.revokeObjectURL(url);
  } catch(err) { alert('Export error: '+err.message); }
  hideLoading();
}

// ---- Loading ----
function showLoading(msg){
  let el = canvasWrap.querySelector('.loading');
  if(!el){ el=document.createElement('div'); el.className='loading'; canvasWrap.appendChild(el); }
  el.innerHTML = `<div class="spinner"></div><div style="color:#94a3b8;font-size:13px">${msg||'Ladowanie...'}</div>`;
  el.style.display='flex';
}
function hideLoading(){
  let el = canvasWrap.querySelector('.loading');
  if(el) el.style.display='none';
  // show canvas back
  let c = canvasWrap.querySelector('canvas');
  if(c) c.style.display='';
  let ip = canvasWrap.querySelector('.info-panel');
  if(ip && currentTab!=='info') ip.remove();
}
</script>
</body>
</html>
"""

# ============================================================================
# FLASK ROUTES
# ============================================================================

@app.route('/')
def index():
    return FRONTEND_HTML

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "pymupdf_version": fitz.version[0],
    })

@app.route('/api/analyze', methods=['POST'])
def analyze():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files['file']
    try:
        data = f.read()
        doc = fitz.open(stream=data, filetype="pdf")
        seps = extract_separations(doc)
        pages = []
        for i in range(len(doc)):
            r = doc[i].rect
            pages.append({"index":i,"width":r.width,"height":r.height})
        doc.close()
        return jsonify({
            "success": True,
            "filename": f.filename,
            "pageCount": len(pages),
            "pages": pages,
            "separations": [s.to_dict() for s in seps],
            "processColors": [
                {"name":"Cyan","kind":"process","cmykRecipe":[100,0,0,0],"displayColor":"#00aeef"},
                {"name":"Magenta","kind":"process","cmykRecipe":[0,100,0,0],"displayColor":"#ec008c"},
                {"name":"Yellow","kind":"process","cmykRecipe":[0,0,100,0],"displayColor":"#fff200"},
                {"name":"Black","kind":"process","cmykRecipe":[0,0,0,100],"displayColor":"#231f20"},
            ],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/render', methods=['POST'])
def render():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files['file']
    page_idx = int(request.form.get('page', 0))
    dpi = min(max(int(request.form.get('dpi', 150)), 72), 600)
    try:
        data = f.read()
        doc = fitz.open(stream=data, filetype="pdf")
        if page_idx >= len(doc):
            return jsonify({"error": "Bad page"}), 400

        cmyk = render_cmyk(doc, page_idx, dpi)
        h, w = cmyk.shape[:2]

        ch = {
            "Cyan":    cmyk[:,:,0],
            "Magenta": cmyk[:,:,1],
            "Yellow":  cmyk[:,:,2],
            "Black":   cmyk[:,:,3],
        }
        for sep in extract_separations(doc):
            ch[sep.name] = extract_spot(cmyk, sep.cmyk_recipe)
        doc.close()

        ch_data = {}
        for name, arr in ch.items():
            ch_data[name] = {"image": to_base64_png(arr), "coverage": coverage(arr)}

        return jsonify({
            "success": True,
            "width": w, "height": h, "dpi": dpi,
            "composite": to_base64_png(cmyk),
            "channels": ch_data,
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-plate', methods=['POST'])
def export():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files['file']
    page_idx = int(request.form.get('page', 0))
    ch_name = request.form.get('channel', 'Black')
    dpi = min(max(int(request.form.get('dpi', 300)), 72), 1200)
    fmt = request.form.get('format', 'png').lower()
    try:
        data = f.read()
        doc = fitz.open(stream=data, filetype="pdf")
        cmyk = render_cmyk(doc, page_idx, dpi)
        if ch_name == "Cyan":    plate = cmyk[:,:,0]
        elif ch_name == "Magenta": plate = cmyk[:,:,1]
        elif ch_name == "Yellow":  plate = cmyk[:,:,2]
        elif ch_name == "Black":   plate = cmyk[:,:,3]
        else:
            seps = extract_separations(doc)
            sep = next((s for s in seps if s.name == ch_name), None)
            if sep: plate = extract_spot(cmyk, sep.cmyk_recipe)
            else: return jsonify({"error": f"Not found: {ch_name}"}), 404
        doc.close()

        img = Image.fromarray(255 - plate, mode='L')
        buf = io.BytesIO()
        if fmt == 'tiff':
            img.save(buf, format='TIFF', compression='lzw', dpi=(dpi,dpi))
            mime, ext = 'image/tiff', 'tiff'
        else:
            img.save(buf, format='PNG', dpi=(dpi,dpi))
            mime, ext = 'image/png', 'png'
        buf.seek(0)
        safe = re.sub(r'[^A-Za-z0-9._-]+', '_', ch_name)
        return send_file(buf, mimetype=mime, as_attachment=True,
                         download_name=f"plate_{safe}_{dpi}dpi.{ext}")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================================================
# START
# ============================================================================

if __name__ == '__main__':
    port = 5000
    print()
    print("=" * 55)
    print("  RIP Preview PRO v2")
    print("=" * 55)
    print(f"  PyMuPDF:  {fitz.version[0]}")
    print(f"  Python:   {sys.version.split()[0]}")
    print()
    print(f"  >>> Otworz w przegladarce:  http://localhost:{port}")
    print()
    print("  Ctrl+C aby zatrzymac")
    print("=" * 55)
    print()

    # Otworz przegladarke automatycznie
    threading.Timer(1.5, lambda: webbrowser.open(f'http://localhost:{port}')).start()

    app.run(host='0.0.0.0', port=port, debug=False)
