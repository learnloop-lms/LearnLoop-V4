@echo off
title Learn Loop - Database Viewer & Search
color 0A

set PATH=C:\Program Files\nodejs;C:\Users\Administrator\AppData\Local\Programs\Python\Python311;%PATH%

"%~dp0venv\Scripts\python.exe" "%~dp0view_db.py"

pause
