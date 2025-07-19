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

### 2. Container Management

- Changes to repository root for consistent path resolution
- Starts Docker containers via docker-compose
- Uses `--force-recreate` flag to ensure clean state
- Container configuration is read from `.devcontainer/docker-compose.yml`

### 3. Database Readiness Check

- Implements a progressive wait system (max 30 seconds)
- 15 iterations with 2-second intervals
- Uses `pg_isready` to verify database availability
- Provides visual feedback during wait period
- Exits with code 1 if database isn't ready after timeout

### 4. Prisma Connection Verification

- Tests database connectivity using Prisma
- Passes environment variables to application container
- Executes `prisma db push` as connection test
- Reports success (exit 0) or failure (exit 1)

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

The following actionable items correspond to the upgrades and improvements outlined above. Check off each item as it is implemented:

- [x] Migrate script from zsh to bash for compatibility
- [x] Remove `.env` file handling in favor of injected secrets
- [x] Check container state before operations (avoid forced recreation)
- [x] Infrastructure setup:
  - [x] Use devcontainer.json for path resolution (support flexible docker-compose.yml locations)
  - [x] Use devcontainer's workspaceFolder for workspace integration
- [ ] Implement staged health checks:
  - [x] Fast-fail environment validation
  - [x] Basic connection verification
  - [x] Authentication verification
  - [x] Application integration testing
- [ ] Container health monitoring:
  - [ ] Test and verify standalone health check script
  - [ ] Document test cases and expected behaviors
  - [ ] Create troubleshooting guide
- [ ] Future considerations (requires approval):
  - [ ] Evaluate Docker HEALTHCHECK integration
  - [ ] Assess devcontainer lifecycle integration options

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
   - Current focus:
     - Ensure reliable standalone operation
     - Comprehensive testing of health check script
     - Document failure scenarios and recovery
   - Recently completed:
     - Migration from zsh to bash
   - Next steps:
     - Test environment variable handling
     - Verify path resolution logic
     - Document test cases and results
     - Create troubleshooting procedures
   - Future considerations (pending review):
     - Container integration options
     - Potential devcontainer integration
