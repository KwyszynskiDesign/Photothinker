@echo off
chcp 65001 >nul 2>&1
title RIP Preview PRO - Instalator

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║     RIP Preview PRO v2 - Instalator Windows      ║
echo  ╚═══════════════════════════════════════════════════╝
echo.

REM === KROK 1: Sprawdz Python ===
echo [1/4] Sprawdzam Python...
echo.

where python >nul 2>&1
if %errorlevel%==0 (
    python --version
    echo      ✓ Python znaleziony
    echo.
    goto :FOUND_PYTHON
)

where python3 >nul 2>&1
if %errorlevel%==0 (
    python3 --version
    echo      ✓ Python3 znaleziony
    echo.
    goto :FOUND_PYTHON3
)

REM Sprawdz typowe lokalizacje
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    echo      ✓ Znaleziono Python w %PYTHON%
    goto :FOUND_CUSTOM
)
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    echo      ✓ Znaleziono Python w %PYTHON%
    goto :FOUND_CUSTOM
)
if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    echo      ✓ Znaleziono Python w %PYTHON%
    goto :FOUND_CUSTOM
)
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
    set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    echo      ✓ Znaleziono Python w %PYTHON%
    goto :FOUND_CUSTOM
)
if exist "C:\Python312\python.exe" (
    set "PYTHON=C:\Python312\python.exe"
    echo      ✓ Znaleziono Python w %PYTHON%
    goto :FOUND_CUSTOM
)
if exist "C:\Python311\python.exe" (
    set "PYTHON=C:\Python311\python.exe"
    echo      ✓ Znaleziono Python w %PYTHON%
    goto :FOUND_CUSTOM
)

echo  ╔═══════════════════════════════════════════════════════╗
echo  ║  BRAK PYTHONA! Musisz go zainstalowac.               ║
echo  ║                                                       ║
echo  ║  1. Otworze strone pobierania...                      ║
echo  ║  2. Pobierz Python 3.12 lub nowszy                    ║
echo  ║  3. WAZNE: Zaznacz "Add Python to PATH" !!            ║
echo  ║  4. Kliknij "Install Now"                              ║
echo  ║  5. Po instalacji uruchom ten skrypt ponownie          ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.
echo  Otwieram strone pobierania Python...
start https://www.python.org/downloads/
echo.
pause
exit /b 1

:FOUND_PYTHON
set "PYTHON=python"
goto :INSTALL

:FOUND_PYTHON3
set "PYTHON=python3"
goto :INSTALL

:FOUND_CUSTOM
goto :INSTALL

:INSTALL
echo [2/4] Tworze srodowisko wirtualne...
echo.
%PYTHON% -m venv venv
if %errorlevel% neq 0 (
    echo      BLAD: Nie udalo sie utworzyc venv
    echo      Sprobuj: %PYTHON% -m pip install virtualenv
    pause
    exit /b 1
)
echo      ✓ venv utworzone
echo.

echo [3/4] Instaluje zależnosci (PyMuPDF, Flask, Pillow, NumPy)...
echo      To moze potrwac 1-2 minuty...
echo.
call venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo      BLAD instalacji. Sprobuj recznie:
    echo      venv\Scripts\activate.bat
    echo      pip install PyMuPDF flask flask-cors Pillow numpy
    pause
    exit /b 1
)
echo.
echo      ✓ Wszystkie pakiety zainstalowane
echo.

echo [4/4] Gotowe!
echo.
echo  ╔═══════════════════════════════════════════════════════╗
echo  ║  INSTALACJA ZAKONCZONA POMYSLNIE!                     ║
echo  ║                                                       ║
echo  ║  Aby uruchomic serwer, uzyj:                          ║
echo  ║     START_SERVER.bat                                   ║
echo  ║                                                       ║
echo  ║  Lub recznie:                                          ║
echo  ║     venv\Scripts\activate.bat                          ║
echo  ║     python rip_server.py                               ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.
pause
