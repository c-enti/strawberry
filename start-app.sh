#!/bin/bash
# start-app.sh: Start backend and frontend for ChronosCraft AI (no tests, no waiting)

##########

# Colors for output
GREEN="\033[0;32m"
RED="\033[0;31m"
NC="\033[0m" # No Color

check_dependencies() {
    local service_dir=$1
    echo -e "${GREEN}Checking dependencies in $service_dir...${NC}"
    if [ -d "$service_dir/node_modules" ]; then
        echo -e "${GREEN}Dependencies already installed.${NC}"
    else
        echo -e "${RED}Installing dependencies...${NC}"
        (cd "$service_dir" && npm install)
    fi
}

start_backend() {
    echo -e "${GREEN}Starting backend...${NC}"
    (cd server && npm run dev) &
    BACKEND_PID=$!
    
    echo -e "${GREEN}Waiting for backend to become ready...${NC}"
    until curl --output /dev/null --silent --head --fail http://localhost:5000; do
        echo "Waiting for backend at http://localhost:5000..."
        sleep 1
    done
    echo -e "${GREEN}Backend is ready!${NC}"
}

start_frontend() {
    echo -e "${GREEN}Starting frontend...${NC}"
    (cd client && npm run dev)
}

# Ensure ports are free
echo "Ensuring ports are free..."
fuser -k 3000/tcp >/dev/null 2>&1 || true
fuser -k 5000/tcp >/dev/null 2>&1 || true
sleep 2

echo "🚧 Building shared package..."
(cd shared && npm install && npm run build) &

echo "🚀 Starting server..."
check_dependencies server
(cd server && npm install && npm run dev) &

echo "🌐 Starting client..."
check_dependencies client
start_frontend

##########

echo "Both backend and frontend are running."
echo "Press Ctrl+C to stop both."

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
