#!/usr/bin/env bash
# CharacterBinder desktop-app launcher for macOS and Linux.
# Runs the app in its own window. Needs Rust in addition to Node.js.
# Just want to use the app? Run ./start.sh instead - browser only, no Rust.
set -u
cd "$(dirname "$0")"

echo
echo "  CharacterBinder - Desktop App"
echo "  ----------------------------"
echo

# --- 1. Node.js --------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "  [X] Node.js is not installed. Get the LTS build from https://nodejs.org"
  echo
  exit 1
fi

NODE_FULL="$(node -v)"
NODE_MAJOR="${NODE_FULL#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "  [X] Node.js 18 or newer is required (found $NODE_FULL)."
  echo "      Update from https://nodejs.org"
  echo
  exit 1
fi

# --- 2. Rust -----------------------------------------------------------
if ! command -v cargo >/dev/null 2>&1; then
  echo "  [X] Rust is not installed."
  echo
  echo "      The desktop build compiles a small Rust shell around the app."
  echo "      1. Go to  https://rustup.rs  and run the installer"
  echo "      2. Open a new terminal and run ./start-desktop.sh again"
  echo
  echo "      Or skip it entirely - ./start.sh runs the same app in your browser."
  echo
  exit 1
fi

# --- 3. Dependencies ---------------------------------------------------
if [ ! -d node_modules ]; then
  echo "  Installing dependencies. This happens once."
  echo
  if ! npm install; then
    echo
    echo "  [X] Dependency install failed. The error is printed above."
    echo
    exit 1
  fi
  echo
fi

# --- 4. Launch ---------------------------------------------------------
echo "  Starting the desktop app."
echo "  The first launch compiles Rust and can take several minutes."
echo "  Later launches are fast."
echo

npm run desktop
