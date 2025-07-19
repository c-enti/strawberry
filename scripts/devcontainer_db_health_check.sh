#!/bin/bash
# devcontainer_db_health_check.sh
# Health check for devcontainer PostgreSQL setup


set -e

# Always run from the repo root so relative paths work
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
cd "$REPO_ROOT"

# Check required environment variables - should be injected by GitHub/Codespaces secrets
if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DB" ]; then
  echo "\n❌ ERROR: One or more required environment variables are not set."
  echo "POSTGRES_USER: ${POSTGRES_USER:-<unset>}"
  if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "POSTGRES_PASSWORD: <unset>"
  else
    echo "POSTGRES_PASSWORD: <set>"
  fi
  echo "POSTGRES_DB: ${POSTGRES_DB:-<unset>}"
  echo "\nPlease ensure these variables are set in your GitHub/Codespaces secrets."
  exit 2
fi

# The environment variables should already be set in the system
export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:5432/$POSTGRES_DB"

# Always run from the repo root so relative paths work
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
cd "$REPO_ROOT"

# Start containers
printf "\n[1/3] Starting containers...\n"
docker compose -f .devcontainer/docker-compose.yml up -d --force-recreate

echo "[2/3] Waiting for database to be ready..."
# Wait for the db to be ready (max 30s)
for i in $(seq 1 15); do
  if docker compose -f .devcontainer/docker-compose.yml exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
    echo "Database is ready!"
    break
  else
    echo "  ...waiting ($i)"
    sleep 2
  fi
  if [ $i -eq 15 ]; then
    echo "Database did not become ready in time."
    exit 1
  fi
done

# Attempt a connection using Prisma (from app container)
echo "[3/3] Testing Prisma connection..."
docker compose -f .devcontainer/docker-compose.yml exec \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -e DATABASE_URL="$DATABASE_URL" \
  -w /chronos app bash -c "cd server && npx prisma db push"
RESULT=$?

if [[ $RESULT -eq 0 ]]; then
  echo "\n✅ Prisma successfully connected to the database."
  exit 0
else
  echo "\n❌ Prisma failed to connect to the database. Check logs and configuration."
  exit 1
fi
