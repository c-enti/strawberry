#!/bin/bash
# dbHealthCheck.test.sh
# Integration test runner for devcontainer_db_health_check.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/.."
HEALTH_CHECK_SCRIPT="$PROJECT_ROOT/devcontainer_db_health_check.sh"

failures=0

run_test() {
  description="$1"
  shift
  echo "\n=== $description ==="
  if "$@"; then
    echo "PASS: $description"
  else
    echo "FAIL: $description"
    failures=$((failures+1))
  fi
}

# Test 1: Missing environment variables
run_test "Fails with missing env vars (should exit 2)" \
  bash -c 'unset POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB; "$HEALTH_CHECK_SCRIPT"; test $? -eq 2'

# Test 2: Invalid credentials (simulate by setting wrong password)
run_test "Fails with invalid credentials (should exit 1)" \
  bash -c 'export POSTGRES_USER=postgres POSTGRES_PASSWORD=wrongpass POSTGRES_DB=postgres; "$HEALTH_CHECK_SCRIPT"; test $? -eq 1'

# Test 3: Database unreachable (simulate by using wrong host)
run_test "Fails with unreachable DB (should exit 1)" \
  bash -c 'export POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres POSTGRES_DB=postgres PGHOST=127.0.0.2; "$HEALTH_CHECK_SCRIPT"; test $? -eq 1'

# Test 4: Success with correct settings (assumes DB is up and credentials are correct)
run_test "Succeeds with correct env and DB (should exit 0)" \
  bash -c 'export POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres POSTGRES_DB=postgres; "$HEALTH_CHECK_SCRIPT"; test $? -eq 0'

# (Optional) Add Prisma check scenarios here if needed

if [ "$failures" -eq 0 ]; then
  echo "\nAll db health check tests passed."
  exit 0
else
  echo "\n$failures test(s) failed."
  exit 1
fi
