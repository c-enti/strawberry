# DevContainer Database Health Check System

This document describes the database health check system implemented in `scripts/devcontainer_db_health_check.sh`. For a complete summary of the current configuration and implementation status, see the [Current Config](#current-config) section at the end of this document.

## Overview

The health check script ensures that the PostgreSQL database is properly configured and accessible within the development container environment. It performs a three-stage verification process with comprehensive error handling.

## Prerequisites

The following environment variables must be available to the database container:

- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Target database name

> **Note:** These environment variables are injected via GitHub secrets (in CI/CD) or Codespaces secrets. Local development may use a `.env` file, but this approach is being deprecated.

### Architecture Note

The health check operates within the devcontainer environment:

- Database checks run through the `app` service's connection to `db`
- Direct PostgreSQL access via internal container networking
- Leverages built-in Docker health check on the `db` service
- No external Docker access required

> **Important:** The health check script should be run from within the devcontainer environment where all required connectivity and permissions are pre-configured.

## Proposed Health Check Integration

NOTICE: This section describes proposed changes that require review and approval before implementation.

The database health check system should be integrated carefully to avoid disrupting development workflows. Here's the proposed approach:

1. Phase 1: Docker Container Level (Proposed)

   - Add HEALTHCHECK to db service
   - Implementation requirements:
     - Must not block container startup
     - Should use progressive checks
     - Must have appropriate timeouts
   - Proposed configuration:
     - 30s interval with 10s timeout
     - 3 retries with 30s start period
   - Success criteria:
     - Container starts reliably
     - Health status accurately reflects database state
     - Does not impact development workflow

2. Phase 2: Development Workflow Integration (Proposed)
   - Integration points to consider:
     - Post-container creation
     - Pre-application startup
     - During development
   - Requirements:
     - Must not block container creation
     - Should provide clear feedback
     - Must have fallback mechanisms
   - Testing strategy needed for:
     - Various failure scenarios
     - Recovery procedures
     - Performance impact

ACTIONABLE ITEMS (Pending Approval):

1. Document detailed testing strategy
2. Create rollback procedures
3. Implement and test Docker HEALTHCHECK in isolation
4. Develop and test integration points
5. Create monitoring and debugging procedures

## Process Stages

### 1. Environment Validation

- Checks for required environment variables
- Constructs the PostgreSQL connection URL
- Exits with code 2 if any required variables are missing
- Shows masked password status for security

### 2. Database Connection Check

- Direct PostgreSQL connectivity check
- Dynamic retry system with exponential backoff
- Configurable via environment variables:
  - DB_CHECK_MAX_ATTEMPTS (default: 5)
  - DB_CHECK_INITIAL_WAIT (default: 2s)
  - DB_CHECK_MAX_WAIT (default: 30s)
- Uses `pg_isready` for lightweight availability check

### 3. Authentication Verification

- Tests full database authentication
- Uses `psql` to verify credentials
- Provides detailed error diagnosis:
  - Database existence check
  - Authentication verification
  - Connectivity confirmation
- Implements same backoff strategy as connection check

### 4. Optional Prisma Verification

- Minimal schema validation only
- Can be bypassed with SKIP_PRISMA_CHECK=true
- No database push or client generation
- Non-blocking for development workflow

## Exit Codes

- 0: Success - Database is ready and Prisma connection verified
- 1: Failure - Database connection or Prisma verification failed
- 2: Configuration Error - Missing environment variables

## Upgrades

### Priority: Environment Setup Migration

**IMPORTANT:** The health check script will rely solely on environment variables injected via GitHub/Codespaces secrets. All `.env` file creation and handling logic will be removed from the scripts and devcontainer lifecycle hooks.

- **Why**: Environment setup is an initialization concern, not a health check concern
- **Impact**: Improved reliability, cleaner separation of concerns
- **Implementation**: Remove `.env` handling entirely, rely on injected environment variables
- **Benefit**: Health check script remains focused on its core purpose
- **Status**: High priority, blocks other improvements

### Shell Migration (zsh to bash)

The script is being migrated from zsh to bash for wider compatibility and standardization:

- **Current**: Uses zsh shell (`#!/bin/zsh`)
- **Target**: Will use bash shell (`#!/bin/bash`)
- **Rationale**: bash is more universally available and is the default shell in most container environments
- **Impact**: No functional changes; syntax is compatible with both shells

### DevContainer Integration Improvements

The following improvements will better align the script with devcontainer best practices:

1. **Environment Variable Management**

   - **Current**: Mixed approach with shell variables and `.env` files
   - **Target**: Use only injected environment variables from secrets
   - **Rationale**: Cleaner separation of concerns, more secure
   - **Impact**: More consistent and secure environment handling

2. **Container Lifecycle Management**

   - **Current**: Forcefully recreates containers with `--force-recreate`
   - **Target**: Check container state before operations
   - **Rationale**: Respect VS Code's container management
   - **Impact**: More efficient container handling, faster operations

3. **Path Resolution**

   - **Current**: Uses hardcoded relative paths
   - **Target**: Use devcontainer.json configuration
   - **Rationale**: Support flexible docker-compose.yml locations
   - **Impact**: More robust path handling

4. **Workspace Integration**

   - **Current**: Forces repository root
   - **Target**: Use devcontainer's workspaceFolder
   - **Rationale**: Follow VS Code workspace conventions
   - **Impact**: Better integration with VS Code environment

5. **Health Check Implementation**

   - **Current**: Custom health check logic with manual retry loops
   - **Target**: Use Docker's built-in health checks with standardized stages:
     1. Environment validation (fast fail)
     2. Connection verification (basic connectivity)
     3. Authentication verification (credential testing)
     4. Application integration (Prisma layer)
   - **Rationale**:
     - Leverage Docker's native health monitoring
     - Standardize health check stages
     - Improve reliability through proper staging
     - Better integration with container lifecycle
   - **Impact**:
     - More reliable health detection
     - Clearer failure points
     - Better integration with Docker ecosystem
     - Standardized monitoring approach

6. **Lifecycle Integration**
   - **Current**: Standalone script execution
   - **Target**: Integration with devcontainer hooks
   - **Rationale**: Better automation and initialization
   - **Impact**: Smoother developer experience

## Usage

The script should be run from the repository root:

```bash
./scripts/devcontainer_db_health_check.sh
```

This is typically executed during development container setup or when verifying database connectivity issues.

## Actionables

The following items represent our implementation plan for the health check system:

### Phase 1: Docker Health Check Integration ✅

- [x] Update db service configuration in docker-compose.yml:
  - [x] Add HEALTHCHECK directive with specified parameters
  - [x] Configure timeouts (30s interval, 10s timeout)
  - [x] Set retry policy (3 retries, 30s start period)
- [x] Create health check validation script:
  - [x] Implement progressive check stages
  - [x] Add proper logging and error reporting
  - [x] Include timeout and retry mechanisms

Note: Health check configuration is complete in docker-compose.yml with comprehensive stages including environment validation, connectivity check, and authentication verification.

### Phase 2: Script Stability Improvements

- [x] Remove Docker command dependencies:
  - [x] Replace docker-compose commands with direct PostgreSQL checks
  - [x] Remove container state management code
  - [x] Remove path resolution complexity
  - [x] Test container-independent operation
- [x] Improve error handling:
  - [x] Remove `set -e` for more controlled error handling
  - [x] Implement proper error propagation (using trap and handle_error)
  - [x] Add detailed error reporting (with line numbers and exit codes)
  - [x] Create error recovery procedures (allowing functions to handle their own errors)
- [x] Enhance timing and retries:
  - [x] Implement dynamic timeouts based on environment (MAX_WAIT, INITIAL_WAIT)
  - [x] Add exponential backoff for retries (doubling wait time up to MAX_WAIT)
  - [x] Configure environment-specific timing defaults (DB*CHECK*\* variables)
  - [x] Add timeout override capabilities (via environment variables)
- [x] Simplify Prisma integration:
  - [x] Minimize invasive Prisma operations (validate only)
  - [x] Implement basic schema validation only (removed push and generate)
  - [x] Remove unnecessary client generation
  - [x] Add Prisma check bypass option (SKIP_PRISMA_CHECK)

### Phase 3: Development Integration

#### Testing & Validation Framework (Required before integration)

- [ ] Create test suite infrastructure:
  - [ ] Create test helper functions for environment simulation
  - [ ] Add test cases for all exit codes and failure modes
  - [ ] Implement environment variable manipulation helpers
  - [ ] Add mocks for PostgreSQL and Prisma responses
- [ ] Document test scenarios:
  - [ ] Missing or invalid environment variables
  - [ ] Network connectivity issues
  - [ ] Authentication failures
  - [ ] Database existence checks
  - [ ] Prisma validation scenarios
- [ ] Create failure simulation framework:
  - [ ] Network interruption simulation
  - [ ] Database restart scenarios
  - [ ] Invalid credential scenarios
  - [ ] Schema validation failures

#### Integration Points (After test framework)

- [ ] Create pre-integration validation:
  - [ ] Verify all required tools available
  - [ ] Check environment variable injection
  - [ ] Validate permissions and access
  - [ ] Test rollback capabilities
- [ ] Implement integration points:
  - [ ] Add safe post-container creation hook
  - [ ] Create recoverable pre-application check
  - [ ] Implement non-blocking status monitoring
- [ ] Design recovery procedures:
  - [ ] Define automatic recovery actions
  - [ ] Create manual intervention guides
  - [ ] Document rollback procedures

#### Performance & Reliability

- [ ] Measure and optimize:
  - [ ] Baseline performance metrics
  - [ ] Timeout and retry optimizations
  - [ ] Resource usage analysis
- [ ] Environment-specific testing:
  - [ ] Local development validation
  - [ ] GitHub Codespaces testing
  - [ ] CI environment verification
- [ ] Monitoring implementation:
  - [ ] Add performance tracking
  - [ ] Create health status reporting
  - [ ] Implement alert mechanisms

Note: No devcontainer.json modifications until all test scenarios pass.

### Phase 4: Documentation & Monitoring

- [ ] Update documentation:
  - [ ] Add detailed testing strategy
  - [ ] Document rollback procedures
  - [ ] Create debugging guide
- [ ] Implement monitoring:
  - [ ] Add status reporting
  - [ ] Create health metrics collection
  - [ ] Document monitoring procedures

### Completed Items

- [x] Migrate script from zsh to bash for compatibility
- [x] Remove `.env` file handling in favor of injected secrets
- [x] Check container state before operations (avoid forced recreation)
- [x] Infrastructure setup:
  - [x] Use devcontainer.json for path resolution
  - [x] Use devcontainer's workspaceFolder for workspace integration
- [x] Implement basic health checks:
  - [x] Fast-fail environment validation
  - [x] Basic connection verification
  - [x] Authentication verification
  - [x] Application integration testing

## Current Config

Current configuration summary based on project documentation and configuration files:

1. Project Structure:

   - ChronosCraft AI project (codename: Strawberry-Vanilla)
   - Split into `client/` (React/Next.js frontend), `server/` (Node.js/Express backend)
   - Uses `.devcontainer/` for development environment configuration
   - Includes `shared/` for common code and `scripts/` for utilities

2. DevContainer Setup:

   - Name: "ChronosCraft v0.1 (Alpha)"
   - Uses Docker Compose with two services
   - Workspace folder: `/workspaces/${localWorkspaceFolderBasename}`
   - Lifecycle hooks:
     - Post-create: Installs dependencies in all workspaces
     - Post-attach: Runs client and server dev servers concurrently

3. Docker Compose Configuration:

   - Two services:
     1. `app`: Main development container
        - Built from local Dockerfile
        - Mounts project at `/workspaces`
        - Depends on `db` service
     2. `db`: PostgreSQL 16 database
        - Uses official postgres:16 image
        - Persistent storage via `postgres-data` volume
        - Configurable via environment variables
        - Exposed on port 5432
        - Built-in health check with stages:
          - Environment validation
          - Basic connectivity check
          - Authentication verification
          - 30s check interval with 10s timeout
          - 3 retries with 30s start period
        - Built-in health check using pg_isready
          - Interval: 10s
          - Timeout: 5s
          - Retries: 3
          - Start period: 10s

4. Database Health Check System:
   - Script: `scripts/devcontainer_db_health_check.sh`
   - Validates environment setup and database connectivity
   - Uses environment variables for configuration
   - Stability improvements completed:
     - Removed all Docker command dependencies
     - Simplified to direct PostgreSQL checks
     - Implemented controlled error handling
     - Added dynamic timeouts with backoff
     - Simplified Prisma integration
   - Current focus:
     - Testing across different environments
     - Documenting error scenarios
     - Validating timeout configurations
     - Gathering feedback on error messages
   - Recently completed:
     - Migration from zsh to bash
     - Docker dependency removal
     - Error handling improvements
     - Dynamic timing implementation
     - Prisma simplification
   - Next steps:
     - Proceed to Phase 3 (Development Integration)
     - Document test scenarios
     - Create failure simulation tests
     - Measure performance impact
   - Future considerations:
     - Environment-specific optimizations
     - Optional Prisma integration
     - Monitoring integration
