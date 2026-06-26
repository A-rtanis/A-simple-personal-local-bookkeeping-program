@echo off
chcp 65001 >nul
echo.
echo Starting finance app...
echo.
node server.js
if errorlevel 1 (
    echo.
    echo Node.js not found. Please install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
)