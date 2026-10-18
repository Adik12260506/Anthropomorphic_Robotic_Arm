@echo off
TITLE Robotic Arm React Frontend (HTTPS Mode for Mobile Cameras)
echo ======================================================================
echo   Starting Vite Frontend with HTTPS on https://0.0.0.0:5173 ...
echo   (Enables Mobile Camera Access on LAN IP in Android Chrome & Safari)
echo ======================================================================
cd /d %~dp0frontend
npm.cmd run dev:https
pause
