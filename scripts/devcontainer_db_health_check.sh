#!/bin/bash
# devcontainer_db_health_check.sh
# Health check for devcontainer PostgreSQL setup


set -e

# Always run from the repo root so relative paths work
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
cd "$REPO_ROOT"

# Function to validate environment variables
validate_environment() {
    local has_error=0
    local error_msg=""

    # Check POSTGRES_USER
    if [ -z "$POSTGRES_USER" ]; then
        error_msg+="\n- POSTGRES_USER is not set"
        has_error=1
    elif [[ ! "$POSTGRES_USER" =~ ^[a-zA-Z][a-zA-Z0-9_]*$ ]]; then
        error_msg+="\n- POSTGRES_USER contains invalid characters (must start with letter, contain only letters, numbers, underscores)"
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
        error_msg+="\n- POSTGRES_DB contains invalid characters (must start with letter, contain only letters, numbers, underscores)"
        has_error=1
    fi

    # Check DB port (if specified)
    if [ ! -z "$POSTGRES_PORT" ] && ! [[ "$POSTGRES_PORT" =~ ^[0-9]+$ ]]; then
        error_msg+="\n- POSTGRES_PORT must be a valid number"
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

# Validate environment variables
if ! validate_environment; then
    exit 2
fi

# Set database URL with optional custom port
POSTGRES_PORT=${POSTGRES_PORT:-5432}
export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:$POSTGRES_PORT/$POSTGRES_DB"

# Function to check container state and act accordingly
check_container_state() {
    local compose_file="$1"
    local service_name="$2"
    
    # Check if service exists in compose file
    if ! docker compose -f "$compose_file" ps "$service_name" >/dev/null 2>&1; then
        echo "Service '$service_name' not found in $compose_file"
        return 1
    fi
    
    # Get container state
    local state=$(docker compose -f "$compose_file" ps --format json "$service_name" | grep -o '"State":"[^"]*"' | cut -d'"' -f4)
    
    case "$state" in
        "running")
            echo "✓ Container $service_name is running"
            return 0
            ;;
        "exited")
            echo "! Container $service_name has exited, restarting..."
            docker compose -f "$compose_file" start "$service_name"
            return $?
            ;;
        "created")
            echo "! Container $service_name is created but not running, starting..."
            docker compose -f "$compose_file" start "$service_name"
            return $?
            ;;
        "")
            echo "! Container $service_name doesn't exist, needs to be created..."
            return 2
            ;;
        *)
            echo "! Container $service_name is in state: $state"
            return 1
            ;;
    esac
}

# Always run from the repo root so relative paths work
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
cd "$REPO_ROOT"

COMPOSE_FILE=".devcontainer/docker-compose.yml"

# Start containers
printf "\n[1/3] Managing containers...\n"

# Check db container state
db_state=$(check_container_state "$COMPOSE_FILE" "db")
db_result=$?

if [ $db_result -eq 2 ]; then
    echo "Creating containers for the first time..."
    docker compose -f "$COMPOSE_FILE" up -d
elif [ $db_result -ne 0 ]; then
    echo "Recreating containers due to invalid state..."
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate
fi

# Function to verify basic database connectivity
verify_connection() {
    local compose_file="$1"
    local max_attempts=15
    local attempt=1
    local timeout=2
    local total_timeout=$((max_attempts * timeout))
    
    echo "[2/3] Verifying database connectivity..."
    echo "• Attempting connection (timeout: ${total_timeout}s)"
    
    while [ $attempt -le $max_attempts ]; do
        # Try basic TCP connection first (faster than pg_isready)
        if docker compose -f "$compose_file" exec db nc -z localhost 5432 >/dev/null 2>&1; then
            echo "✓ TCP connection successful"
            
            # Then check if PostgreSQL is accepting connections
            if docker compose -f "$compose_file" exec db pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
                echo "✓ PostgreSQL is accepting connections"
                return 0
            else
                echo "! PostgreSQL process not ready (attempt $attempt/$max_attempts)"
            fi
        else
            echo "! Port 5432 not responding (attempt $attempt/$max_attempts)"
        fi
        
        sleep $timeout
        attempt=$((attempt + 1))
    done
    
    echo "✗ Database connection verification failed after ${total_timeout} seconds"
    return 1
}

echo "[2/3] Verifying database connectivity..."
if ! verify_connection "$COMPOSE_FILE"; then
    echo "Failed to establish basic database connectivity"
    exit 1
fi

# Function to verify database authentication
verify_auth() {
    local compose_file="$1"
    local max_attempts=3
    local attempt=1
    local timeout=2
    
    echo "[3/4] Verifying database authentication..."
    echo "• Testing credentials and database access"
    
    while [ $attempt -le $max_attempts ]; do
        # Try to list databases (requires successful auth)
        if docker compose -f "$compose_file" exec db psql \
            -h localhost \
            -p "${POSTGRES_PORT:-5432}" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            -c "\l" >/dev/null 2>&1; then
            echo "✓ Authentication successful"
            echo "✓ Database '$POSTGRES_DB' is accessible"
            return 0
        else
            echo "! Authentication failed (attempt $attempt/$max_attempts)"
            
            # Check specific failure reasons
            if docker compose -f "$compose_file" exec db psql \
                -h localhost \
                -p "${POSTGRES_PORT:-5432}" \
                -U "$POSTGRES_USER" \
                -d postgres \
                -c "\l" >/dev/null 2>&1; then
                echo "  → Can authenticate but database '$POSTGRES_DB' might not exist"
            else
                echo "  → Invalid credentials or connection refused"
            fi
        fi
        
        sleep $timeout
        attempt=$((attempt + 1))
    done
    
    echo "✗ Authentication verification failed after $max_attempts attempts"
    return 1
}

echo "[3/4] Verifying database authentication..."
if ! verify_auth "$COMPOSE_FILE"; then
    echo "Failed to authenticate with the database"
    exit 1
fi

# Attempt application integration using Prisma
echo "[4/4] Testing Prisma integration..."
docker compose -f "$COMPOSE_FILE" exec \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -e DATABASE_URL="$DATABASE_URL" \
    -w /chronos app bash -c "cd server && npx prisma db push"
RESULT=$?

if [[ $RESULT -eq 0 ]]; then
    echo "✓ Prisma successfully connected to the database"
    exit 0
else
    echo "✗ Prisma integration failed. Check logs and configuration"
    exit 1
fi
