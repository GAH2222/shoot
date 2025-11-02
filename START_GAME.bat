@echo off
echo ========================================
echo       SHOOTY - STARTING GAME
echo ========================================
echo.
echo Starting local server...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Python found! Starting server...
    start http://localhost:8000/game.html
    python -m http.server 8000
) else (
    echo Python not found. Trying alternative method...
    
    REM Try Python3
    python3 --version >nul 2>&1
    if %errorlevel% == 0 (
        echo Python3 found! Starting server...
        start http://localhost:8000/game.html
        python3 -m http.server 8000
    ) else (
        echo.
        echo ERROR: Python not found!
        echo.
        echo Please install Python from: https://www.python.org/downloads/
        echo Make sure to check "Add Python to PATH" during installation
        echo.
        echo OR just open game.html in Firefox browser
        echo.
        pause
    )
)
