#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Starting Vite Frontend on http://0.0.0.0:5173 ..."
cd "$SCRIPT_DIR/frontend"
npm run dev
