@echo off
TITLE AI-Enabled Anthropomorphic Robotic Arm - HTTPS Prototype Launcher
echo ======================================================================
echo   AI-Enabled Vision-Based Anthropomorphic Robotic Arm (Review 2 - HTTPS)
echo ======================================================================
echo.

echo Starting FastAPI Backend Server on http://0.0.0.0:8000 ...
start "Robotic Arm FastAPI Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo Starting Vite React Frontend with HTTPS on https://0.0.0.0:5173 ...
start "Robotic Arm React Frontend (HTTPS)" cmd /k "cd /d %~dp0frontend && npm.cmd run dev:https"

echo.
echo ======================================================================
echo   System running in HTTPS Mode!
echo   - Local Dashboard:  https://localhost:5173
echo   - Backend API Docs: http://localhost:8000/docs
echo   - Mobile Wi-Fi URL: https://<your-local-ip>:5173
echo.
echo   Note for Mobile Phones:
echo   Accept the self-signed SSL warning by tapping "Advanced -> Proceed"
echo   to allow camera and WebRTC access over your local Wi-Fi.
echo ======================================================================
pause
