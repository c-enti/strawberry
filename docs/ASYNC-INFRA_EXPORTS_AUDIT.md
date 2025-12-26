# ASYNC-INFRA Exports Audit

**Date**: December 26, 2025  @ 2:40PM
**Purpose**: Document Phase 1 exports for Phase 2 delegation  
**Status**: ✅ VERIFIED

---

## Helpers (`server/helpers/index.js`)

**What it exports**:

```javascript
module.exports = {
  timingResolver,
  fifoScheduler,
  statusManager,
};
```

**How to import**:

```javascript
const { timingResolver, fifoScheduler, statusManager } = require("../helpers");
```

### timingResolver

**Purpose**: Compute ETA and schedule from manifest

**Method**:

```javascript
timingResolver.compute(manifest, config) → { totalEta, totalEtaMs, schedule }
```

**Input**:

- `manifest` - object with `.totalRequests` and `.sequence` (array of call tiers)
- `config` - object with `.modelSpacing` and `.modelLatencies`

**Output**:

- `totalEta` - in seconds
- `totalEtaMs` - in milliseconds
- `schedule` - array of call slots with timing information

### fifoScheduler

**Purpose**: Build FIFO schedule with proper spacing from timing

**Method**:

```javascript
fifoScheduler.build(timing) → { calls, totalEta }
```

**Input**:

- `timing` - output from `timingResolver.compute()`

**Output**:

- `calls` - array of scheduled calls
- `totalEta` - total ETA in seconds

### statusManager

**Purpose**: Per-request status tracking

**Methods**:

```javascript
// Initialize status for a job
statusManager.init(resultId, { eta, totalCalls })

// Update progress during execution
statusManager.updateProgress(resultId, {
  callsCompleted,
  currentCall,
  totalCalls,
  eta,
  errors
})

// Get current status
statusManager.getStatus(resultId) → status object

// Delete status when job complete
statusManager.deleteStatus(resultId)
```

---

## Orchestrator (`server/orchestrator.js`)

**What it exports**:

```javascript
module.exports = Orchestrator;
```

**How to import**:

```javascript
const Orchestrator = require("../orchestrator");
```

### Constructor

```javascript
new Orchestrator(resultId, (customHelpers = {}), (customAiService = null));
```

**Parameters**:

- `resultId` - job identifier (string UUID)
- `customHelpers` - optional object with `{ timingResolver, fifoScheduler, statusManager }` for testing
- `customAiService` - optional custom AI service (defaults to aiService)

### Instance Properties

```javascript
orchestrator.resultId; // job id
orchestrator.manifest; // captured on first call
orchestrator.eta; // computed ETA in seconds
orchestrator.helpers; // { timingResolver, fifoScheduler, statusManager }
```

### Instance Method

```javascript
async orchestrator.generate(prompt, options) → result
```

**Parameters**:

- `prompt` - the request text
- `options` - object with:
  - `tier` - "expert" or "standard" (maps to Pro or Flash)
  - `callIndex` - which call in sequence (0, 1, 2, ...)
  - `manifest` - ONLY on first call (service declares what it needs)

**Returns**: Result from AI service

**Behavior**:

- First call: captures manifest, computes ETA, builds schedule
- Subsequent calls: enforces FIFO spacing, tracks progress

---

## SmartPoller (`server/utilities/smartPoller.js`)

**What it exports**:

```javascript
module.exports = new SmartPoller(); // Singleton instance
```

**How to import**:

```javascript
const smartPoller = require("../utilities/smartPoller");
```

### Methods

```javascript
// Register a new job
smartPoller.assignTask(resultId, { eta, totalCalls })

// Update progress during execution
smartPoller.updateProgress(resultId, {
  callsCompleted,
  currentCall,
  totalCalls,
  eta,
  errors
})

// Get current job status
smartPoller.getStatus(resultId) → status object

// Mark job as complete
smartPoller.markComplete(resultId, result)

// Mark job as errored
smartPoller.markError(resultId, error)

// Remove job from tracker
smartPoller.deleteStatus(resultId)
```

### Status Object Structure

```javascript
{
  resultId, // job id
    status, // "in-progress", "complete", or "error"
    eta, // seconds remaining
    totalCalls, // total orchestrator calls
    callsCompleted, // calls finished so far
    progress_percent, // 0-100
    startedAt, // timestamp
    lastUpdatedAt, // timestamp
    result, // final output (if complete)
    error, // error details (if error)
    errors; // array of errors during execution
}
```

---

## Logger (`server/utils/logger.js`)

**What it exports**:

```javascript
module.exports = logger; // Singleton logger instance
```

**How to import**:

```javascript
const logger = require("../utils/logger");
```

### Methods

```javascript
logger.info(message); // Log info level
logger.debug(message); // Log debug level
logger.warn(message); // Log warning level
logger.error(message, err); // Log error with optional error object
```

---

## Summary: Phase 1 Exports Verified

| Component      | Location   | Export Type | Available |
| -------------- | ---------- | ----------- | --------- |
| timingResolver | helpers/   | Function    | ✅        |
| fifoScheduler  | helpers/   | Function    | ✅        |
| statusManager  | helpers/   | Object      | ✅        |
| Orchestrator   | server/    | Class       | ✅        |
| smartPoller    | utilities/ | Singleton   | ✅        |
| logger         | utils/     | Singleton   | ✅        |

All Phase 1 exports are documented and ready for Phase 2 delegation.

---

**Status**: ✅ AUDIT COMPLETE  
**Ready for**: Step 1.2 (Phase 1 Test Suite Run)
