import { writable, derived } from "svelte/store";

/**
 * Flow state enum
 * @type {Object<string, string>}
 */
const STATES = {
  INITIAL: "INITIAL",
  MEDIUM_SELECTED: "MEDIUM_SELECTED",
  GENERATING: "GENERATING",
  POLLING: "POLLING",
  CLASSIFICATION_READY: "CLASSIFICATION_READY",
  RESULT_READY: "RESULT_READY",
  OVERRIDE_ACTIVE: "OVERRIDE_ACTIVE",
  COMPLETE: "COMPLETE",
  ERROR: "ERROR",
};

/**
 * Valid state transitions
 * Maps current state to allowed next states
 * @type {Object<string, string[]>}
 */
const VALID_TRANSITIONS = {
  [STATES.INITIAL]: [STATES.MEDIUM_SELECTED],
  [STATES.MEDIUM_SELECTED]: [STATES.GENERATING, STATES.INITIAL],
  [STATES.GENERATING]: [
    STATES.POLLING,
    STATES.CLASSIFICATION_READY,
    STATES.RESULT_READY,
    STATES.ERROR,
  ],
  [STATES.POLLING]: [STATES.RESULT_READY, STATES.ERROR],
  [STATES.CLASSIFICATION_READY]: [
    STATES.GENERATING,
    STATES.OVERRIDE_ACTIVE,
    STATES.INITIAL,
    STATES.ERROR,
  ],
  [STATES.RESULT_READY]: [
    STATES.OVERRIDE_ACTIVE,
    STATES.COMPLETE,
    STATES.INITIAL,
    STATES.ERROR,
  ],
  [STATES.OVERRIDE_ACTIVE]: [
    STATES.GENERATING,
    STATES.RESULT_READY,
    STATES.ERROR,
  ],
  [STATES.COMPLETE]: [STATES.INITIAL],
  [STATES.ERROR]: [STATES.INITIAL, STATES.MEDIUM_SELECTED],
};

/**
 * Create the flow store with 9-state machine (including POLLING)
 */
function createFlowStore() {
  const { subscribe, set, update } = writable({
    state: STATES.INITIAL,
    selectedMedium: "",
    prompt: "",
    classification: null,
    result: null,
    latency: 0,
    overrideCost: 0,
    error: null,
    startTime: null, // For elapsed time tracking
    resultId: null, // For polling phase
    pollingStartedAt: null,
    currentProgressPercent: 0,
    currentEta: null,
    calls_completed: 0,
    calls_total: 0,
  });

  return {
    subscribe,

    /**
     * Set the current state with validation
     * @param {string} newState - Target state
     * @throws {Error} If transition is invalid
     */
    setState(newState) {
      update((store) => {
        const currentState = store.state;

        // Validate transition
        if (!VALID_TRANSITIONS[currentState]?.includes(newState)) {
          console.warn(
            `Invalid state transition: ${currentState} → ${newState}. Allowed: ${VALID_TRANSITIONS[
              currentState
            ]?.join(", ")}`
          );
          return store;
        }

        return { ...store, state: newState };
      });
    },

    /**
     * Set the selected medium
     * @param {string} medium - Medium name (ebook, calendar, poster, stickers, card)
     */
    setMedium(medium) {
      update((store) => ({ ...store, selectedMedium: medium }));
    },

    /**
     * Set the user's prompt
     * @param {string} prompt - The prompt text
     */
    setPrompt(prompt) {
      update((store) => ({ ...store, prompt }));
    },

    /**
     * Set the classification result from API
     * @param {Object} classObj - Classification object from /api/classify
     */
    setClassification(classObj) {
      update((store) => ({ ...store, classification: classObj }));
    },

    /**
     * Set the generation/override result from API
     * @param {Object} resultObj - Result object from /api/generate or /api/override
     */
    setResult(resultObj) {
      update((store) => ({ ...store, result: resultObj }));
    },

    /**
     * Set the latency of the last operation
     * @param {number} ms - Latency in milliseconds
     */
    setLatency(ms) {
      update((store) => ({ ...store, latency: ms }));
    },

    /**
     * Set the override cost multiplier
     * @param {number} cost - Cost multiplier value
     */
    setOverrideCost(cost) {
      update((store) => ({ ...store, overrideCost: cost }));
    },

    /**
     * Set the start time for elapsed time tracking
     * @param {number} timestamp - Timestamp in milliseconds
     */
    setStartTime(timestamp = Date.now()) {
      update((store) => ({ ...store, startTime: timestamp }));
    },

    /**
     * Set error
     * @param {Object} errorObj - Error object with {status, message, retryable}
     */
    setError(errorObj) {
      update((store) => ({ ...store, error: errorObj }));
    },

    /**
     * Update polling progress (called during POLLING state)
     * @param {Object} progressData - {percent, message, eta, calls_completed, calls_total}
     */
    updateProgress(progressData) {
      update((store) => ({
        ...store,
        currentProgressPercent:
          progressData.percent ?? store.currentProgressPercent,
        currentMessage: progressData.message ?? store.currentMessage,
        currentEta: progressData.eta ?? store.currentEta,
        calls_completed: progressData.calls_completed ?? store.calls_completed,
        calls_total: progressData.calls_total ?? store.calls_total,
      }));
    },

    /**
     * Set the resultId for polling
     * @param {string} id - Result ID from 202 response
     */
    setResultId(id) {
      update((store) => ({ ...store, resultId: id }));
    },

    /**
     * Clear all state and return to INITIAL
     */
    reset() {
      set({
        state: STATES.INITIAL,
        selectedMedium: "",
        prompt: "",
        classification: null,
        result: null,
        latency: 0,
        overrideCost: 0,
        error: null,
        startTime: null,
        resultId: null,
        pollingStartedAt: null,
        currentProgressPercent: 0,
        currentEta: null,
        calls_completed: 0,
        calls_total: 0,
      });
    },
  };
}

// Export singleton store instance
export const flowStore = createFlowStore();

/**
 * Derived Stores - Computed state for common use cases
 */

// Overall flow progress (0-100) based on current state
export const flowProgress = derived(flowStore, ($flowStore) => {
  const stateProgress = {
    [STATES.INITIAL]: 0,
    [STATES.MEDIUM_SELECTED]: 10,
    [STATES.GENERATING]: 50,
    [STATES.POLLING]: $flowStore.currentProgressPercent || 60,
    [STATES.CLASSIFICATION_READY]: 60,
    [STATES.RESULT_READY]: 90,
    [STATES.OVERRIDE_ACTIVE]: 70,
    [STATES.COMPLETE]: 100,
    [STATES.ERROR]: 0,
  };
  return stateProgress[$flowStore.state] || 0;
});

// Whether the flow is idle (not in progress)
export const isFlowIdle = derived(flowStore, ($flowStore) => {
  // A component checking if flow is idle would need access to loading states
  // Since the lib version has minimal state, we check the state directly
  return ![STATES.GENERATING, STATES.POLLING, STATES.OVERRIDE_ACTIVE].includes(
    $flowStore.state
  );
});

// Total elapsed time (in ms) since flow started
export const elapsedTime = derived(flowStore, ($flowStore) => {
  if (!$flowStore.startTime) return 0;
  return Date.now() - $flowStore.startTime;
});

// Format latency for display (e.g., "123ms" or "2.5s")
export const formattedLatency = derived(flowStore, ($flowStore) => {
  const ms = $flowStore.latency;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});

// Export state constants for components
export { STATES, VALID_TRANSITIONS };
