@echo off
title Learn Loop - Adaptive Gamified LMS Launcher
color 0B

echo ========================================================
echo        STARTING LEARN LOOP (ADAPTIVE GAMIFIED LMS)
echo ========================================================
echo.

set PATH=C:\Program Files\nodejs;C:\Users\Administrator\AppData\Local\Programs\Python\Python311;%PATH%

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "Learn Loop Backend" /D "%~dp0backend" cmd /k "..\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Starting React Frontend on http://localhost:5173 ...
start "Learn Loop Frontend" /D "%~dp0frontend" cmd /k "npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo Opening browser to http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo Learn Loop is now running! Keep these windows open.
echo To stop, simply close the backend and frontend windows.
echo ========================================================
pause
