# DevContainer Database Health Check System

## Purpose

**Script Implementation Review Stamp**

> ✅ Verified: As of 2025-07-21, the implementation in `devcontainer_db_health_check.sh` fully meets the documented specification. All layers (Core Database Service, Prisma Setup, Application Schema) are implemented and verified. The script correctly handles schema validation, provides detailed error reporting, and includes verbose output options. If this documentation is modified, this verification stamp is invalidated and a new review will be required.

### Script Functionality

The script operates in layers, each building on successful completion of the previous:

#### Layer 1: Core Database Service ✅

- **Purpose:** Is the database service ready?
- Checks environment variables
- Verifies database connection
- Tests basic authentication
- Returns UP/DOWN status

```bash
./devcontainer_db_health_check.sh
# Output: DB: UP
```

#### Layer 2: Prisma Setup ✅

_Only runs if Layer 1 returns UP_

- Verify DATABASE_URL format
- Check Prisma schema exists
- Test Prisma client initialization

```bash
./devcontainer_db_health_check.sh --check=prisma
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

#### Layer 3: Application Schema ✅

_Only runs if Layer 2 succeeds_

- Verify Calendar table exists
- Verify Event table exists

```bash
./devcontainer_db_health_check.sh --check=schema
# Output: DB: UP
#         Prisma: OK
#         Schema: VALID
#
# If a required table is missing:
# Output: DB: UP
#         Prisma: OK
#         Schema: ERROR: Table 'Calendar' not found
```

#### Usage Examples

```bash
# Basic service check (Layer 1)
./devcontainer_db_health_check.sh

# Check through Prisma layer (Layers 1-2)
./devcontainer_db_health_check.sh --check=prisma

# Full application check (All layers)
./devcontainer_db_health_check.sh --check=all

# Multiple options
./devcontainer_db_health_check.sh --verbose --prisma

# With verbose output (schema details)
VERBOSE=true ./devcontainer_db_health_check.sh --check=schema
```

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

> **Schema Check Note:** Table checks are performed in the 'public' schema by default. If you need to check tables in other schemas, use verbose mode for detailed output.

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
