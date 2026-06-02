# RIP Preview Server

Serwer Python z PyMuPDF do prawdziwego rozdzielania separacji CMYK i kolorów spot z plików PDF.

## Wymagania

- Python 3.9 lub nowszy
- pip (menedżer pakietów Python)

## Instalacja

### Windows

```powershell
# 1. Otwórz PowerShell lub Command Prompt
# 2. Przejdź do katalogu server
cd server

# 3. Utwórz wirtualne środowisko (opcjonalnie, ale zalecane)
python -m venv venv
venv\Scripts\activate

# 4. Zainstaluj zależności
pip install -r requirements.txt
```

### macOS / Linux

```bash
# 1. Otwórz terminal
# 2. Przejdź do katalogu server
cd server

# 3. Utwórz wirtualne środowisko (opcjonalnie, ale zalecane)
python3 -m venv venv
source venv/bin/activate

# 4. Zainstaluj zależności
pip install -r requirements.txt
```

## Uruchomienie

```bash
# Windows
python rip_server.py

# macOS / Linux
python3 rip_server.py
```

Serwer uruchomi się na `http://localhost:5000`

## API Endpoints

### GET /api/health
Sprawdzenie stanu serwera.

### POST /api/analyze
Analiza PDF - zwraca informacje o stronach i wykrytych separacjach.

**Parametry (multipart/form-data):**
- `file`: plik PDF

**Odpowiedź:**
```json
{
  "success": true,
  "filename": "example.pdf",
  "pageCount": 2,
  "pages": [...],
  "separations": [
    {
      "name": "PANTONE 185 C",
      "kind": "spot",
      "cmykRecipe": [0, 91, 76, 0],
      "displayColor": "#ed1c24"
    }
  ],
  "processColors": [...]
}
```

### POST /api/render
Renderowanie strony z rozdzieleniem na kanały CMYK i spot.

**Parametry (multipart/form-data):**
- `file`: plik PDF
- `page`: numer strony (0-indexed)
- `dpi`: rozdzielczość (72-600)

**Odpowiedź:**
```json
{
  "success": true,
  "width": 2480,
  "height": 3508,
  "dpi": 300,
  "composite": "base64...",
  "channels": {
    "Cyan": {"image": "base64...", "coverage": 12.5},
    "Magenta": {"image": "base64...", "coverage": 8.3},
    ...
  }
}
```

### POST /api/export-plate
Eksport pojedynczej płyty jako PNG lub TIFF.

**Parametry (multipart/form-data):**
- `file`: plik PDF
- `page`: numer strony
- `channel`: nazwa kanału ("Cyan", "Magenta", "Yellow", "Black" lub nazwa spot)
- `dpi`: rozdzielczość eksportu
- `format`: "png" lub "tiff"

## Rozwiązywanie problemów

### "ModuleNotFoundError: No module named 'fitz'"
Zainstaluj PyMuPDF:
```bash
pip install PyMuPDF
```

### "Permission denied" na macOS/Linux
```bash
chmod +x rip_server.py
```

### Port 5000 jest zajęty
Zmień port w ostatniej linii `rip_server.py`:
```python
app.run(host='0.0.0.0', port=5001, debug=True)
```

## Licencja

MIT License
