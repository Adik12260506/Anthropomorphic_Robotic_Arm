#!/usr/bin/env bash
# AI-Enabled Vision-Based Anthropomorphic Robotic Arm - Push to GitHub Script
set -e

REPO_URL="https://github.com/Adik12260506/Anthropomorphic_Robotic_Arm.git"

echo "======================================================================"
echo "  AI-Enabled Vision-Based Anthropomorphic Robotic Arm"
echo "  Target Repo: $REPO_URL"
echo "======================================================================"
echo ""

# Verify git
if ! command -v git &> /dev/null; then
    echo "❌ Git is not yet available."
    echo "Please finish the 'Install Command Line Developer Tools' prompt on your screen."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Initialize git if needed
if [ ! -d ".git" ]; then
    echo "📦 Initializing local Git repository..."
    git init
    git branch -M main
fi

# 2. Configure remote origin
if git remote | grep -q '^origin$'; then
    git remote set-url origin "$REPO_URL"
else
    git remote add origin "$REPO_URL"
fi

# 3. Stage files
echo "📄 Staging project files (excluding node_modules, caches, build files)..."
git add .

# 4. Commit
echo "💾 Creating initial commit..."
if git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "Notice: Working tree clean, nothing new to commit."
else
    git commit -m "feat: complete AI-enabled anthropomorphic robotic arm (vision, WebRTC, kinematics, simulation, APK)"
fi

# 5. Push to GitHub
echo "🚀 Pushing to GitHub (main branch)..."
git push -u origin main

echo ""
echo "======================================================================"
echo "  ✅ SUCCESS! Your project is now live on GitHub:"
echo "  👉 https://github.com/Adik12260506/Anthropomorphic_Robotic_Arm"
echo "======================================================================"
