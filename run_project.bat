@echo off
TITLE AI-Enabled Anthropomorphic Robotic Arm - Review 2 Prototype Launcher
echo ======================================================================
echo   AI-Enabled Vision-Based Anthropomorphic Robotic Arm (Review 2)
echo ======================================================================
echo.

echo Starting FastAPI Backend Server on http://0.0.0.0:8000 ...
start "Robotic Arm FastAPI Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo Starting Vite React TypeScript Frontend on http://0.0.0.0:5173 ...
start "Robotic Arm React Frontend" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

echo.
echo ======================================================================
echo   System running!
echo   - Local Dashboard:  http://localhost:5173
echo   - Backend API Docs: http://localhost:8000/docs
echo   - Mobile Wi-Fi URL: Check terminal output for your local LAN IP
echo.
echo   * NOTE FOR 2-PHONE MOBILE CAMERA ACCESS:
echo   To access the camera from external mobile phones over Wi-Fi,
echo   run 'run_project_https.bat' instead to enable secure HTTPS!
echo ======================================================================
pause
