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

# Main execution
main() {
    check_environment || exit $?
    check_db_connection || exit 1
    verify_auth || exit 1
}

main
