#!/bin/bash
# EventControl - double-click to start (macOS). Keep the window open while using the app.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org, then run this again."
  open https://nodejs.org
  read -r -p "Press Enter to close..."
  exit 1
fi
# Install packages on first run, and again whenever an update changed them.
if ! cmp -s package-lock.json node_modules/.ec-installed-lock; then
  echo "Installing packages - this takes 1-3 minutes the first time..."
  npm install || { echo "npm install failed."; read -r -p "Press Enter to close..."; exit 1; }
  cp package-lock.json node_modules/.ec-installed-lock
fi
echo "Starting EventControl... your browser will open http://localhost:5173 shortly."
(sleep 15 && open http://localhost:5173) &
npm run dev
