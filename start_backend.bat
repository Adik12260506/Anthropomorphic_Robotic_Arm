@echo off
TITLE Robotic Arm FastAPI Backend
echo Starting FastAPI Backend on http://0.0.0.0:8000 ...
cd /d %~dp0backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
