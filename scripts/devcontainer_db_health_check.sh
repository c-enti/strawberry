#!/bin/bash
# devcontainer_db_health_check.sh
# Quick status script for DB health in devcontainer

set -euo pipefail


# --- Config ---
REQUIRED_VARS=(POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB)
DB_HOSTS=("${PGHOST:-localhost}" "db")
DB_PORT="${PGPORT:-5432}"

# --- Check environment variables ---
missing_vars=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing_vars+=("$var")
  fi
done

if (( ${#missing_vars[@]} > 0 )); then
  for var in "${missing_vars[@]}"; do
    echo "Missing: $var"
  done
  echo "DB: UNKNOWN (missing env vars)"
  exit 2
fi


# --- Check DB reachability for multiple hosts ---
if ! command -v pg_isready >/dev/null 2>&1; then
  echo "pg_isready not found in PATH"
  echo "DB: UNKNOWN (pg_isready missing)"
  exit 2
fi

db_up=0
for host in "${DB_HOSTS[@]}"; do
  echo -n "Checking DB at $host:$DB_PORT/$POSTGRES_DB ... "
  if pg_isready -h "$host" -p "$DB_PORT" -d "$POSTGRES_DB" -U "$POSTGRES_USER" > /dev/null 2>&1; then
    echo "UP"
    db_up=1
  else
    echo "DOWN"
  fi
done

if [[ $db_up -eq 1 ]]; then
  echo "DB: UP (at least one host reachable)"
  exit 0
else
  echo "DB: DOWN (none of the tested hosts are reachable)"
  exit 1
fi

# Initialize error handling without set -e for more control
trap 'handle_error $? $LINENO' ERR

# Global timeout and retry settings (can be overridden by environment variables)
MAX_ATTEMPTS=${DB_CHECK_MAX_ATTEMPTS:-5}
INITIAL_WAIT=${DB_CHECK_INITIAL_WAIT:-2}
MAX_WAIT=${DB_CHECK_MAX_WAIT:-30}

# Error handling function
handle_error() {
    local exit_code=$1
    local line_no=$2
    echo "❌ Error on line ${line_no}: Command exited with status ${exit_code}"
    # Don't exit - let the function handle its own errors
}

# Function to validate environment variables
validate_environment() {
    local has_error=0
    local error_msg=""

    # Check POSTGRES_USER
    if [ -z "$POSTGRES_USER" ]; then
        error_msg+="\n- POSTGRES_USER is not set"
        has_error=1
    elif [[ ! "$POSTGRES_USER" =~ ^[a-zA-Z][a-zA-Z0-9_]*$ ]]; then
        error_msg+="\n- POSTGRES_USER contains invalid characters"
        has_error=1
    fi

    # Check POSTGRES_PASSWORD
    if [ -z "$POSTGRES_PASSWORD" ]; then
        error_msg+="\n- POSTGRES_PASSWORD is not set"
        has_error=1
    elif [ ${#POSTGRES_PASSWORD} -lt 8 ]; then
        error_msg+="\n- POSTGRES_PASSWORD is too short (minimum 8 characters)"
        has_error=1
    fi

    # Check POSTGRES_DB
    if [ -z "$POSTGRES_DB" ]; then
        error_msg+="\n- POSTGRES_DB is not set"
        has_error=1
    elif [[ ! "$POSTGRES_DB" =~ ^[a-zA-Z][a-zA-Z0-9_]*$ ]]; then
        error_msg+="\n- POSTGRES_DB contains invalid characters"
        has_error=1
    fi

    # If any errors were found, display them and exit
    if [ $has_error -eq 1 ]; then
        echo -e "\n❌ ERROR: Environment validation failed:$error_msg"
        echo -e "\nCurrent values:"
        echo "POSTGRES_USER: ${POSTGRES_USER:-<unset>}"
        if [ -z "$POSTGRES_PASSWORD" ]; then
            echo "POSTGRES_PASSWORD: <unset>"
        else
            echo "POSTGRES_PASSWORD: <set>"
        fi
        echo "POSTGRES_DB: ${POSTGRES_DB:-<unset>}"
        echo "POSTGRES_PORT: ${POSTGRES_PORT:-5432}"
        echo -e "\nPlease ensure these variables are set correctly in your GitHub/Codespaces secrets."
        return 1
    fi

    # All validations passed
    echo "✅ Environment validation passed"
    return 0
}

# Function to check database connectivity with exponential backoff
check_db_connection() {
    local attempt=1
    local wait_time=$INITIAL_WAIT
    
    echo "[1/3] Checking database connectivity..."
    
    while [ $attempt -le $MAX_ATTEMPTS ]; do
        echo "• Attempt $attempt/$MAX_ATTEMPTS (waiting ${wait_time}s)"
        
        if pg_isready -h db -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" > /dev/null 2>&1; then
            echo "✅ Database is accepting connections"
            return 0
        fi
        
        sleep $wait_time
        wait_time=$(( wait_time * 2 ))
        if [ $wait_time -gt $MAX_WAIT ]; then
            wait_time=$MAX_WAIT
        fi
        
        attempt=$(( attempt + 1 ))
    done
    
    echo "❌ Database connection failed after $MAX_ATTEMPTS attempts"
    return 1
}

# Function to verify database authentication
verify_auth() {
    local attempt=1
    local wait_time=$INITIAL_WAIT
    
    echo "[2/3] Verifying database authentication..."
    
    while [ $attempt -le $MAX_ATTEMPTS ]; do
        echo "• Attempt $attempt/$MAX_ATTEMPTS (waiting ${wait_time}s)"
        
        if PGPASSWORD="$POSTGRES_PASSWORD" psql -h db -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\l" > /dev/null 2>&1; then
            echo "✅ Successfully authenticated to database"
            return 0
        fi
        
        echo "! Authentication failed (attempt $attempt/$MAX_ATTEMPTS)"
        
        # Check if we can connect to postgres database (indicates auth works but DB doesn't exist)
        if PGPASSWORD="$POSTGRES_PASSWORD" psql -h db -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" -d postgres -c "\l" > /dev/null 2>&1; then
            echo "  → Can authenticate but database '$POSTGRES_DB' might not exist"
        else
            echo "  → Invalid credentials or connection refused"
        fi
        
        sleep $wait_time
        wait_time=$(( wait_time * 2 ))
        if [ $wait_time -gt $MAX_WAIT ]; then
            wait_time=$MAX_WAIT
        fi
        
        attempt=$(( attempt + 1 ))
    done
    
    echo "❌ Authentication verification failed after $MAX_ATTEMPTS attempts"
    return 1
}

# Function to perform basic Prisma check (optional)
check_prisma() {
    # Skip if SKIP_PRISMA_CHECK is set
    if [ "${SKIP_PRISMA_CHECK}" = "true" ]; then
        echo "[3/3] Skipping Prisma check (SKIP_PRISMA_CHECK=true)"
        return 0
    fi

    echo "[3/3] Performing minimal Prisma check..."
    
    # Only validate schema, don't push or generate
    if [ -f "server/prisma/schema.prisma" ]; then
        if cd server && npx prisma validate > /dev/null 2>&1; then
            echo "✅ Prisma schema is valid"
            cd ..
            return 0
        else
            echo "❌ Prisma schema validation failed"
            cd ..
            return 1
        fi
    else
        echo "⚠️  No Prisma schema found, skipping check"
        return 0
    fi
}

# Main execution flow with proper error handling
main() {
    local exit_code=0
    
    # 1. Validate environment
    if ! validate_environment; then
        return 2
    fi
    
    # Set database URL with optional custom port
    POSTGRES_PORT=${POSTGRES_PORT:-5432}
    export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:$POSTGRES_PORT/$POSTGRES_DB"
    
    # 2. Check database connection
    if ! check_db_connection; then
        return 1
    fi
    
    # 3. Verify authentication
    if ! verify_auth; then
        return 1
    fi
    
    # 4. Optional Prisma check
    if ! check_prisma; then
        return 1
    fi
    
    echo "✅ All health checks passed successfully"
    return 0
}

# Execute main and capture its exit code
main
exit $?
