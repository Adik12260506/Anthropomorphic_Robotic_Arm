#!/usr/bin/env bash
# AI-Enabled Vision-Based Anthropomorphic Robotic Arm - macOS / Linux Launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================================================"
echo "  AI-Enabled Vision-Based Anthropomorphic Robotic Arm"
echo "  Platform: macOS / Linux"
echo "======================================================================"
echo ""

# Verify Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not found on your system."
    echo "👉 Please install Python 3 (e.g. from python.org or via Homebrew: brew install python)"
    exit 1
fi

# Verify Node
if ! command -v npm &> /dev/null; then
    echo "❌ Error: Node.js / npm is not found on your system."
    echo "👉 Please install Node.js (e.g. from nodejs.org or via Homebrew: brew install node)"
    exit 1
fi

# Function to clean up child processes on exit
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

# 2. Start Frontend Server
echo "🚀 Starting Vite React Frontend on http://0.0.0.0:5173 ..."
cd "$SCRIPT_DIR/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo ""
echo "======================================================================"
echo "  System running successfully!"
echo "  - Local Dashboard:     http://localhost:5173"
echo "  - Phone on same Wi-Fi: http://${LAN_IP}:5173"
echo "  - Backend API Docs:    http://localhost:8000/docs"
echo "  - Health Check:        http://localhost:8000/health"
echo ""
echo "  💡 TIP for Mobile Video Feeds:"
echo "     Mobile browsers require HTTPS for camera access over Wi-Fi."
echo "     Run ./run_project_https.sh for full two-way camera streaming!"
echo "======================================================================"

# Wait for both processes
wait
