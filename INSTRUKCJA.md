# RIP Preview PRO v2 - Instrukcja

## Wymagania

- **Python 3.9+** (do serwera)
- **Przeglądarka** (Chrome, Firefox, Edge)

## Instalacja i Uruchomienie

### Krok 1: Uruchom serwer Python

#### Windows:
```powershell
cd server
start_server.bat
```

Lub ręcznie:
```powershell
cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python rip_server.py
```

#### macOS / Linux:
```bash
cd server
chmod +x start_server.sh
./start_server.sh
```

Lub ręcznie:
```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 rip_server.py
```

Serwer uruchomi się na **http://localhost:5000**

### Krok 2: Otwórz aplikację

Otwórz plik `dist/index.html` w przeglądarce.

Lub uruchom serwer deweloperski:
```bash
npm run dev
```

## Jak to działa

```
┌─────────────────┐         ┌──────────────────┐
│   Przeglądarka  │  HTTP   │  Serwer Python   │
│   (React UI)    │ ◄─────► │  (PyMuPDF/fitz)  │
└─────────────────┘         └──────────────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │    Plik PDF      │
                           │  (CMYK + Spot)   │
                           └──────────────────┘
```

1. **Frontend (React)** - interfejs użytkownika w przeglądarce
2. **Backend (Python + PyMuPDF)** - przetwarza PDF na serwerze:
   - Renderuje strony w natywnym CMYK (nie RGB!)
   - Wyodrębnia definicje /Separation i /DeviceN
   - Rozdziela kanały spot na podstawie receptur CMYK
   - Eksportuje płyty w wysokiej rozdzielczości

## Funkcje

### Wykrywanie separacji
- **CMYK Process** - Cyan, Magenta, Yellow, Black
- **Spot Colors** - Pantone, HKS, TOYO, DIC, custom
- **Technical Layers** - die-cut, crease, varnish, foil

### Podgląd
- Kompozyt CMYK z włączanymi/wyłączanymi kanałami
- Podgląd pojedynczych płyt (kolorowy lub szary)
- Symulacja rastra (AM halftone)

### Eksport
- PNG kompozytu
- Pojedyncze płyty 300-1200 DPI
- TIFF lub PNG

### Analiza
- Pokrycie tuszem (coverage %)
- Total Ink Coverage (TIC)
- Ostrzeżenia o przekroczeniu 300% TIC

## Rozwiązywanie problemów

### "Server offline"
Serwer Python nie jest uruchomiony. Uruchom go zgodnie z instrukcją powyżej.

### "CORS error" w konsoli
Serwer musi działać na localhost:5000. Sprawdź czy nie ma innego procesu na tym porcie.

### Brak wykrytych spot colors
- PDF może nie zawierać przestrzeni /Separation lub /DeviceN
- Kolory spot mogły być skonwertowane do CMYK przed eksportem

### Wolne renderowanie
Zmniejsz DPI w ustawieniach (72-150 dla podglądu, 300+ dla eksportu).

## Różnica vs Streamlit

| Cecha | Streamlit (oryginał) | React + Serwer |
|-------|---------------------|----------------|
| Rendering CMYK | ✅ Natywny (fitz) | ✅ Natywny (fitz) |
| Spot colors | ⚠️ Regex na tekście | ✅ Parsowanie obiektów |
| UI | Streamlit widgets | React + Tailwind |
| Responsywność | ❌ Przeładowanie | ✅ Natychmiastowa |
| Zoom/Pan | ❌ | ✅ |
| Eksport płyt | ✅ PNG | ✅ PNG/TIFF |

## Licencja

MIT License
