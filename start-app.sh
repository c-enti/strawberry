#!/bin/bash
# start-app.sh: Start backend and frontend for ChronosCraft AI (no tests, no waiting)

# ────────────────────────────────────────────────────────────────
# 🌈 Terminal Colors
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m" # No Color

log() {
  echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} $1"
}

# ────────────────────────────────────────────────────────────────
# ⚙️ Dependency Check
check_dependencies() {
  local dir=$1
  log "Checking dependencies in $dir..."
  if [ ! -d "$dir" ]; then
    echo -e "${RED}Directory '$dir' does not exist!${NC}"
    exit 1
  fi
  if [ -d "$dir/node_modules" ]; then
    log "Dependencies already installed in $dir."
  else
    log "Installing dependencies in $dir..."
    (cd "$dir" && npm install)
  fi
}

# ────────────────────────────────────────────────────────────────
# 🔧 Kill Conflicting Ports
kill_ports() {
  log "Freeing ports (3000, 5000)..."
  fuser -k 3000/tcp >/dev/null 2>&1 || true
  fuser -k 5000/tcp >/dev/null 2>&1 || true
}

# ────────────────────────────────────────────────────────────────
# 📦 Build Shared Package
build_shared() {
  log "Building shared package..."
  (cd shared && npm install && npm run build)
}

# ────────────────────────────────────────────────────────────────
# 🚀 Start Backend
start_backend() {
  log "Starting backend server..."
  (cd server && npm run dev) &
  BACKEND_PID=$!

  log "Waiting for backend to become ready..."
  until curl --silent --fail http://localhost:5000 >/dev/null; do
    log "Waiting for backend at http://localhost:5000..."
    sleep 2
  done
  echo -e "${GREEN}✅ Backend is listening! Giving it a moment to stabilize...${NC}"
  sleep 8 # <--- ADD THIS LINE. Adjust the number of seconds if needed.
  echo -e "${GREEN}✅ Backend is ready!${NC}"
  log "Backend is ready!"
}

# ────────────────────────────────────────────────────────────────
# 🌐 Start Frontend
start_frontend() {
  log "Starting frontend..."
  (cd client && npm run dev) &
  FRONTEND_PID=$!
}

# ────────────────────────────────────────────────────────────────
# 🚦 Kickstart Routine
kill_ports
build_shared

check_dependencies server
check_dependencies client

start_backend
start_frontend

log "${GREEN}Both backend and frontend are running.${NC}"
log "Press Ctrl+C to terminate both."

wait $BACKEND_PID $FRONTEND_PID
