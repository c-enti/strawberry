#!/bin/bash
# start-app.sh: Start backend and frontend for ChronosCraft AI (no tests, no waiting)

# Exit on error
set -e

# Kill any process on ports 3000 and 5000 (optional)
fuser -k 3000/tcp >/dev/null 2>&1 || true
fuser -k 5000/tcp >/dev/null 2>&1 || true
sleep 2

echo "Starting backend server..."
(cd server && npm run dev) &
BACKEND_PID=$!

echo "Starting frontend..."
(cd client && npm run dev) &
FRONTEND_PID=$!

echo "Both backend and frontend are running."
echo "Press Ctrl+C to stop both."

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
