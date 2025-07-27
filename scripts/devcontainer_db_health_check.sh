#!/bin/bash

# DevContainer Database Health Check System
# Purpose: Verify database-related system resources required by the application

# Exit codes:
# 0: Success - All required resources are available
# 1: Failure - Resource access failed
# 2: Configuration Error - Missing or invalid environment variables

# Configuration
REQUIRED_VARS=("POSTGRES_USER" "POSTGRES_PASSWORD" "POSTGRES_DB")
DB_HOST="${DB_HOST:-db}"  # Default to 'db' service name
DB_PORT="${DB_PORT:-5432}"  # Default PostgreSQL port
DB_CHECK_MAX_ATTEMPTS="${DB_CHECK_MAX_ATTEMPTS:-5}"
DB_CHECK_INITIAL_WAIT="${DB_CHECK_INITIAL_WAIT:-2}"
DB_CHECK_MAX_WAIT="${DB_CHECK_MAX_WAIT:-30}"
PRISMA_SCHEMA_PATH="${PRISMA_SCHEMA_PATH:-server/prisma/schema.prisma}"
DATABASE_URL="${DATABASE_URL:-}"  # Optional, but required for Prisma check

# Function to check environment variables
check_environment() {
    local missing_vars=()
    local invalid_vars=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        elif [[ "${!var}" =~ [[:space:]] ]]; then
            invalid_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]] || [[ ${#invalid_vars[@]} -gt 0 ]]; then
        echo "DB: DOWN"
        [[ ${#missing_vars[@]} -gt 0 ]] && echo "Missing: ${missing_vars[*]}"
        [[ ${#invalid_vars[@]} -gt 0 ]] && echo "Invalid (contains spaces): ${invalid_vars[*]}"
        exit 2
    fi
    
    return 0
}

# Function to check PostgreSQL service reachability
check_db_connection() {
    local attempt=1
    local wait_time=$DB_CHECK_INITIAL_WAIT
    
    while [[ $attempt -le $DB_CHECK_MAX_ATTEMPTS ]]; do
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
            return 0
        fi
        
        echo "Connection attempt $attempt failed, waiting ${wait_time}s..."
        sleep "$wait_time"
        
        # Exponential backoff with max cap
        wait_time=$(( wait_time * 2 ))
        [[ $wait_time -gt $DB_CHECK_MAX_WAIT ]] && wait_time=$DB_CHECK_MAX_WAIT
        
        ((attempt++))
    done
    
    echo "DB: DOWN"
    echo "Error: Database unreachable after $DB_CHECK_MAX_ATTEMPTS attempts"
    return 1
}

# Function to verify database authentication
verify_auth() {
    if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' >/dev/null 2>&1; then
        echo "DB: UP"
        return 0
    else
        echo "DB: DOWN"
        echo "Error: Authentication failed"
        return 1
    fi
}

# Layer 2: Prisma Integration
check_database_url_format() {
    # Basic regex for postgresql://user:pass@host:port/db
    if [[ -z "$DATABASE_URL" ]]; then
        echo "Prisma: ERROR: DATABASE_URL not set"
        return 2
    fi
    if [[ ! "$DATABASE_URL" =~ ^postgresql://[^:]+:[^@]+@[^:]+:[0-9]+/.+ ]]; then
        echo "Prisma: ERROR: DATABASE_URL format invalid"
        return 2
    fi
    return 0
}

check_prisma_schema_exists() {
    if [[ ! -f "$PRISMA_SCHEMA_PATH" ]]; then
        echo "Prisma: ERROR: Schema file not found at $PRISMA_SCHEMA_PATH (Prisma checks require this file. Is your project initialized?)"
        return 2
    fi
    if [[ ! -r "$PRISMA_SCHEMA_PATH" ]]; then
        echo "Prisma: ERROR: Schema file at $PRISMA_SCHEMA_PATH is not readable (Check file permissions.)"
        return 2
    fi
    return 0
}

check_prisma_client() {
    # Validate schema and client setup
    if npx --yes prisma validate --schema="$PRISMA_SCHEMA_PATH" >/dev/null 2>&1; then
        echo "Prisma: OK"
        return 0
    else
        echo "Prisma: ERROR: Prisma validation failed"
        return 1
    fi
}

main() {
    # Parse arguments
    CHECK_MODE="service"
    for arg in "$@"; do
        case $arg in
            --check=*)
                CHECK_MODE="${arg#*=}"
                ;;
            --prisma)
                CHECK_MODE="prisma"
                ;;
            --schema)
                CHECK_MODE="schema"
                ;;
            --all)
                CHECK_MODE="all"
                ;;
        esac
    done

    check_environment || exit $?
    check_db_connection || exit 1
    verify_auth || exit 1

    if [[ "$CHECK_MODE" == "prisma" || "$CHECK_MODE" == "all" ]]; then
        check_database_url_format || exit $?
        check_prisma_schema_exists || exit $?
        check_prisma_client || exit $?
    fi

    if [[ "$CHECK_MODE" == "schema" || "$CHECK_MODE" == "all" ]]; then
        # Layer 3: Schema validation
        VERBOSE=${VERBOSE:-false}
        tables_missing=false
        
        for table in "Calendar" "Event"; do
            if ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
                "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table');" | grep -q t; then
                tables_missing=true
                echo "Schema: WARNING: Table '$table' not found, attempting automatic fix..."
                break
            fi
        done
        
        if [[ "$tables_missing" == "true" ]]; then
            # Attempt auto-fix using prisma migrate
            if npx --yes prisma migrate deploy --schema="$PRISMA_SCHEMA_PATH"; then
                # Verify fix worked
                tables_valid=true
                for table in "Calendar" "Event"; do
                    if ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
                        "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table');" | grep -q t; then
                        tables_valid=false
                        break
                    fi
                done
                
                if [[ "$tables_valid" == "true" ]]; then
                    echo "Schema: VALID"
                else
                    echo "Schema: ERROR: Auto-fix failed. Manual intervention required."
                    [[ "$VERBOSE" == "true" ]] && echo "Error: Tables still missing after migration. Try running 'prisma migrate deploy' manually."
                    exit 1
                fi
            else
                echo "Schema: ERROR: Auto-fix failed. Manual intervention required."
                [[ "$VERBOSE" == "true" ]] && echo "Error: Migration failed. Run 'prisma migrate deploy' manually for detailed error messages."
                exit 1
            fi
        else
            echo "Schema: VALID"
        fi
    fi
}

main "$@"
