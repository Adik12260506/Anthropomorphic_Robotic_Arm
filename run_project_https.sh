#!/usr/bin/env bash
# AI-Enabled Vision-Based Anthropomorphic Robotic Arm - macOS Launcher (HTTPS Mode for Mobile Devices)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================================================"
echo "  AI-Enabled Vision-Based Anthropomorphic Robotic Arm (HTTPS Mode)"
echo "  Platform: macOS / Linux"
echo "======================================================================"
echo ""

# Verify Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not found on your system."
    echo "👉 Please install Python 3"
    exit 1
fi

# Verify Node
if ! command -v npm &> /dev/null; then
    echo "❌ Error: Node.js / npm is not found on your system."
    echo "👉 Please install Node.js"
    exit 1
fi

cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Backend Server
echo "🚀 Starting FastAPI Backend Server on http://0.0.0.0:8000 ..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "venv" ]; then
    echo "📦 Setting up backend Python virtual environment..."
    python3 -m venv venv
    venv/bin/pip install -r requirements.txt
fi
source venv/bin/activate
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 2

# 2. Start Frontend Server with HTTPS
echo "🚀 Starting Vite React Frontend with HTTPS on https://0.0.0.0:5173 ..."
cd "$SCRIPT_DIR/frontend"
npm run dev:https -- --host 0.0.0.0 &
FRONTEND_PID=$!

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo ""
echo "======================================================================"
echo "  System running in HTTPS Mode (Best for Mobile Camera & WebRTC)!"
echo "  - Local Dashboard (HTTPS): https://localhost:5173"
echo "  - Phone B on same Wi-Fi:   https://${LAN_IP}:5173"
echo "  - Backend API Docs:       http://localhost:8000/docs"
echo ""
echo "  📱 Mobile Device Connection:"
echo "  1. On your phone, open: https://${LAN_IP}:5173"
echo "  2. Tap 'Advanced' -> 'Proceed to ${LAN_IP}' (SSL bypass for LAN)."
echo "  3. Join Room with Room ID from Phone A."
echo "  4. Both camera video feeds will exchange seamlessly over Wi-Fi!"
echo "======================================================================"

wait
