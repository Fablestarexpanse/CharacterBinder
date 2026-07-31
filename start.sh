#!/usr/bin/env bash
# CharacterBinder launcher for macOS and Linux.
# Double-click it, or run:  ./start.sh
set -u
cd "$(dirname "$0")"

echo
echo "  CharacterBinder"
echo "  ---------------"
echo

open_browser() {
  if command -v open >/dev/null 2>&1; then open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1"
  fi
}

# --- 1. Is Node.js installed? ------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "  [X] Node.js is not installed."
  echo
  echo "      CharacterBinder needs Node.js to run."
  echo "      1. Go to  https://nodejs.org"
  echo "      2. Download the \"LTS\" version and install it"
  echo "      3. Run ./start.sh again"
  echo
  exit 1
fi

# --- 2. Is it new enough? (Vite needs Node 18+) ------------------------
NODE_FULL="$(node -v)"
NODE_MAJOR="${NODE_FULL#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "  [X] Your Node.js is too old ($NODE_FULL). Version 18 or newer is required."
  echo
  echo "      Install the current LTS from  https://nodejs.org"
  echo "      then run ./start.sh again."
  echo
  exit 1
fi

# --- 3. Already running? Just open the browser. ------------------------
# Resolve "localhost" rather than hardcoding 127.0.0.1: Vite binds to the IPv6
# loopback (::1) on many systems, so an IPv4-only probe misses a live server and
# we'd start a second one that dies on "port already in use".
port_in_use() {
  if command -v curl >/dev/null 2>&1; then
    curl -s -o /dev/null --max-time 2 "http://localhost:3737" && return 0
  fi
  (echo >/dev/tcp/localhost/3737) >/dev/null 2>&1 && return 0
  return 1
}

if port_in_use; then
  echo "  CharacterBinder is already running."
  echo "  Opening http://localhost:3737 ..."
  open_browser "http://localhost:3737"
  echo
  exit 0
fi

# --- 4. First run? Install dependencies. -------------------------------
if [ ! -d node_modules ]; then
  echo "  First run - installing dependencies."
  echo "  This happens once and takes a minute or two."
  echo
  if ! npm install; then
    echo
    echo "  [X] Dependency install failed. Check your internet connection"
    echo "      and try again. The error is printed above."
    echo
    exit 1
  fi
  echo
fi

# --- 5. Launch. --------------------------------------------------------
echo "  Starting CharacterBinder at http://localhost:3737"
echo "  Your browser will open automatically."
echo
echo "  Keep this terminal open while you work."
echo "  Press Ctrl+C to stop the app."
echo

npm start
