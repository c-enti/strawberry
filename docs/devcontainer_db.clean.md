# DevContainer Database Health Check System

## Purpose

### Script Functionality

The script operates in layers, each building on successful completion of the previous:

#### Layer 1: Core Database Service ✅

- **Purpose:** Is the database service ready?
- Checks environment variables
- Verifies database connection
- Tests basic authentication
- Returns UP/DOWN status

```bash
./scripts/devcontainer_db_health_check.sh
# Output: DB: UP
```

#### Layer 2: Prisma Setup ✅

_Only runs if Layer 1 returns UP_

- Verify DATABASE_URL format
- Check Prisma schema exists
- Test Prisma client initialization

```bash
./scripts/devcontainer_db_health_check.sh --check=prisma
# Output: DB: UP
#         Prisma: OK
#
# If the Prisma schema file is missing (default path: server/prisma/schema.prisma):
# Output: DB: UP
#         Prisma: ERROR: Schema file not found at server/prisma/schema.prisma (Prisma checks require this file. Is your project initialized?)
#
# If the Prisma schema file is not readable:
# Output: DB: UP
#         Prisma: ERROR: Schema file at server/prisma/schema.prisma is not readable (Check file permissions.)
```

#### Layer 3: Application Schema [ ]

_Only runs if Layer 2 succeeds_

- Verify Calendar table
- Verify Event table
- Check required columns

```bash
./scripts/devcontainer_db_health_check.sh --check=schema
# Output: DB: UP
#         Prisma: OK
#         Schema: VALID
```

#### Usage Examples

```bash
# Basic service check (Layer 1)
./scripts/devcontainer_db_health_check.sh

# Check through Prisma layer (Layers 1-2)
./scripts/devcontainer_db_health_check.sh --check=prisma

# Full application check (All layers)
./scripts/devcontainer_db_health_check.sh --check=all
```

### Design Philosophy

1. **Core Service Check**

   - Always runs first
   - Must be fast and reliable
   - Returns clear UP/DOWN status
   - Never compromised by extensions

2. **Optional Extensions**

   - Only run after basic check passes
   - Can include:
     - Prisma connectivity
     - Schema validation
     - Table structure checks
   - Fail independently of core check

3. **Implementation Choices**
   - Add parameters to base script
   - OR
   - Create wrapper script for advanced checks

## Current Status

✅ Core functionality working and ready
⏳ Extensions can be added as needed

## Usage

### Integration Notes

#### Core Script Integration

> Before adding to container startup:
>
> 1. Verify basic check works reliably
> 2. Ensure fast failure when needed
> 3. Confirm clear status output
> 4. Check startup time impact

#### Extension Integration

> When adding extended checks:
>
> 1. Never compromise core function
> 2. Keep extensions optional
> 3. Maintain clear error separation
> 4. Document each extension clearly

## Usage Guide

### Basic Execution

```bash
# Basic check - just database readiness
./scripts/devcontainer_db_health_check.sh

# With additional checks
./scripts/devcontainer_db_health_check.sh --verbose      # Detailed output
./scripts/devcontainer_db_health_check.sh --prisma       # Include Prisma check
./scripts/devcontainer_db_health_check.sh --schema       # Check table structure
./scripts/devcontainer_db_health_check.sh --all          # Run all checks

# Multiple options
./scripts/devcontainer_db_health_check.sh --verbose --prisma
```

### Implementation Plan

#### Layer 1: Core Service (Completed ✅)

- [x] Environment validation
- [x] PostgreSQL reachability
- [x] Basic authentication
- [x] Clear status output

#### Layer 2: Prisma Integration

- [ ] Add --check parameter handling
- [ ] Validate DATABASE_URL format
- [ ] Verify prisma schema location
- [ ] Test Prisma client initialization
- [ ] Add Prisma-specific status output

#### Layer 3: Schema Validation

- [ ] Query table definitions
- [ ] Verify Calendar table structure
- [ ] Verify Event table structure
- [ ] Add schema validation output

### Available Options

- `--check=service`: Basic database check (default)
- `--check=prisma`: Include Prisma validation
- `--check=schema`: Include schema validation
- `--check=all`: Run all checks
- `--verbose`: Show detailed progress
- `--help`: Show usage information

### Required Environment Variables

- `POSTGRES_USER`: Database username
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Target database name
- `DATABASE_URL`: Prisma connection string (format: postgresql://user:password@host:port/dbname)

### Optional Configuration

- `DB_HOST`: Database hostname (default: "db")
- `DB_PORT`: Database port (default: 5432, internal Docker network)
- `DB_CHECK_MAX_ATTEMPTS`: Max retry attempts (default: 5)
- `DB_CHECK_INITIAL_WAIT`: Initial retry wait time (default: 2s)
- `DB_CHECK_MAX_WAIT`: Maximum retry wait time (default: 30s)

> **Note:** The database runs on port 5432 within the Docker network. The `app` service connects to it using `db:5432`. While this port is mapped to the host, it might be restricted by security settings.

### Exit Codes

- `0`: Success - Database ready
- `1`: Failure - Connection/auth failed
- `2`: Config Error - Missing/invalid variables

## Support

### Common Issues

1. Configuration Errors (Exit 2)

   - Missing environment variables
   - Invalid variable format
   - Solution: Verify environment setup

2. Connection Errors (Exit 1)

   - Database unreachable
   - Network issues
   - Solution: Check service status

3. Authentication Errors (Exit 1)
   - Invalid credentials
   - Database doesn't exist
   - Solution: Verify credentials

### Getting Help

- Check error messages for specific guidance
- Review troubleshooting steps
- Consult documentation for error codes
