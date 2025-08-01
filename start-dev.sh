#!/bin/bash
# start-dev.sh: Resilient development watchdog for ChronosCraft AI.

# ────────────────────────────────────────────────────────────────
# 🌈 Terminal Colors
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m" # No Color

# ────────────────────────────────────────────────────────────────
# 🌐 Service URLs
BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"

# ────────────────────────────────────────────────────────────────
# 📣 Logging
log() {
  echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} $1"
}

# ────────────────────────────────────────────────────────────────
# 🔌 Kill Conflicting Ports
free_port() {
  local PORT=$1
  local PID
  PID=$(lsof -i tcp:$PORT -sTCP:LISTEN -t)
  if [ -n "$PID" ]; then
    log "${RED}Killing process on port $PORT (PID $PID)...${NC}"
    kill -9 "$PID"
  fi
}

# ────────────────────────────────────────────────────────────────
# 💡 Health Check Logic
health_check() {
  local URL=$1
  curl --silent --fail "$URL" >/dev/null
}

# ────────────────────────────────────────────────────────────────
# 🔁 Watchdog Function
watch_process() {
  local NAME=$1
  local DIR=$2
  local CMD=$3
  local URL=$4
  local MAX_FAILURES=5

  while true; do
    log "${GREEN}[${NAME}] Launching service...${NC}"
    (
      cd "$DIR" || { log "${RED}Directory '$DIR' not found.${NC}"; exit 1; }
      eval "$CMD"
    ) &
    PID=$!
    log "${GREEN}[${NAME}] PID: $PID${NC}"

    local FAILURES=0
    while kill -0 "$PID" 2>/dev/null; do
      if health_check "$URL"; then
        FAILURES=0
      else
        FAILURES=$((FAILURES + 1))
        log "${RED}[${NAME}] Health check failed ($FAILURES).${NC}"
        if [ "$FAILURES" -ge "$MAX_FAILURES" ]; then
          log "${RED}[${NAME}] Restarting...${NC}"
          kill -9 "$PID"
          break
        fi
      fi
      sleep 5
    done

    log "${RED}[${NAME}] Process exited or was killed. Restarting...${NC}"
    sleep 2
  done
}

# ────────────────────────────────────────────────────────────────
# 🧼 Startup Routine
log "Freeing required ports..."
free_port 3000
free_port 5000

log "Building shared package..."
if [ -d shared ]; then
  (cd shared && npm install && npm run build)
else
  log "${RED}Shared folder missing. Cannot proceed.${NC}"
  exit 1
fi

# ────────────────────────────────────────────────────────────────
# ⚡ Kick Off Services
watch_process "Backend" "server" "npm run dev" "$BACKEND_URL" &
watch_process "Frontend" "client" "npm run dev" "$FRONTEND_URL" &

# Wait forever
wait
