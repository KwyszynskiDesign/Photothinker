@echo off
chcp 65001 >nul 2>&1
title RIP Preview PRO v2

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║        RIP Preview PRO v2 - START                ║
echo  ╚═══════════════════════════════════════════════════╝
echo.

REM Zapisz sciezke projektu
set "PROJECT_DIR=%~dp0"
set "SERVER_DIR=%PROJECT_DIR%server"

echo  Katalog projektu: %PROJECT_DIR%
echo  Katalog serwera:  %SERVER_DIR%
echo.

REM Sprawdz czy katalog server istnieje
if not exist "%SERVER_DIR%\rip_server.py" (
    echo  BLAD: Nie znaleziono pliku server\rip_server.py
    echo  Upewnij sie ze uruchamiasz skrypt z katalogu projektu.
    pause
    exit /b 1
)

cd /d "%SERVER_DIR%"

REM === Sprawdz Python ===
set "PYTHON="

where python >nul 2>&1
if %errorlevel%==0 (
    set "PYTHON=python"
    goto :CHECK_PYTHON_VERSION
)

where python3 >nul 2>&1
if %errorlevel%==0 (
    set "PYTHON=python3"
    goto :CHECK_PYTHON_VERSION
)

REM Szukaj w typowych lokalizacjach
for %%V in (313 312 311 310 39) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
        set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        goto :CHECK_PYTHON_VERSION
    )
)

echo.
echo  ══════════════════════════════════════════════════════
echo  PYTHON NIE ZNALEZIONY!
echo.
echo  Musisz zainstalowac Python:
echo.
echo  1. Otworze strone python.org ...
echo  2. Kliknij "Download Python 3.x.x"
echo  3. *** WAZNE: Zaznacz "Add Python to PATH" ***
echo  4. Kliknij "Install Now"
echo  5. Po instalacji URUCHOM TEN SKRYPT PONOWNIE
echo  ══════════════════════════════════════════════════════
echo.
start https://www.python.org/downloads/
pause
exit /b 1

:CHECK_PYTHON_VERSION
echo  [✓] Python znaleziony: %PYTHON%
%PYTHON% --version
echo.

REM === Tworz venv jesli nie istnieje ===
if not exist "venv\Scripts\python.exe" (
    echo  [..] Tworze srodowisko wirtualne...
    %PYTHON% -m venv venv
    if %errorlevel% neq 0 (
        echo  BLAD: Nie mozna utworzyc venv
        pause
        exit /b 1
    )
    echo  [✓] Srodowisko wirtualne utworzone
    echo.
)

REM === Aktywuj venv ===
call venv\Scripts\activate.bat

REM === Instaluj pakiety jesli brak ===
python -c "import fitz; import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [..] Instaluje pakiety (to moze potrwac ~2 min)...
    echo      - PyMuPDF (obsluga PDF/CMYK)
    echo      - Flask (serwer HTTP)  
    echo      - Pillow (obsluga obrazow)
    echo      - NumPy (obliczenia)
    echo.
    pip install --upgrade pip --quiet 2>nul
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo.
        echo  BLAD instalacji pakietow!
        echo  Sprobuj recznie:
        echo    cd "%SERVER_DIR%"
        echo    venv\Scripts\activate.bat
        echo    pip install PyMuPDF flask flask-cors Pillow numpy
        pause
        exit /b 1
    )
    echo.
    echo  [✓] Pakiety zainstalowane
    echo.
)

echo.
echo  ══════════════════════════════════════════════════════
echo  SERWER STARTUJE...
echo.
echo  Adres:   http://localhost:5000
echo  Stop:    Ctrl+C w tym oknie
echo  ══════════════════════════════════════════════════════
echo.

REM Otworz przegladarke z plikiem HTML (po krotkim opoznieniu)
if exist "%PROJECT_DIR%dist\index.html" (
    echo  Otwieram przegladarke za 3 sekundy...
    start /b cmd /c "timeout /t 3 /nobreak >nul & start "" "%PROJECT_DIR%dist\index.html""
) else (
    echo  UWAGA: Brak dist\index.html - otworz frontend recznie
)

REM Uruchom serwer (blokujace)
python rip_server.py
