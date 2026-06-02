@echo off
chcp 65001 >nul 2>&1
title RIP Preview PRO v2

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║    RIP Preview PRO v2 - SERVER        ║
echo  ╚═══════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Szukaj Pythona
set "PY="
where python >nul 2>&1 && set "PY=python" && goto :RUN
where python3 >nul 2>&1 && set "PY=python3" && goto :RUN
where py >nul 2>&1 && set "PY=py" && goto :RUN

for %%V in (313 312 311 310) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
        set "PY=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        goto :RUN
    )
)

echo  BRAK PYTHONA! Pobierz z https://www.python.org/downloads/
echo  Zaznacz "Add Python to PATH" przy instalacji!
start https://www.python.org/downloads/
pause
exit /b 1

:RUN
echo  Python: %PY%
echo.
%PY% rip_server.py
if %errorlevel% neq 0 (
    echo.
    echo  Blad! Sprawdz komunikaty powyzej.
    pause
)
