/**
 * GenerateFlow.svelte - Phase A-B Orchestrator Component
 *
 * Coordinates the entire generation flow:
 * 1. User selects medium + enters prompt
 * 2. Classify prompt
 * 3. Accept or override classification
 * 4. Generate content with classification
 * 5. Review result and optionally apply overrides
 *
 * State transitions are driven by this component and API responses.
 */

<script>
  import { onMount } from "svelte";
  import { flowStore, flowProgress } from "../lib/stores/flowStore.js";
  import { classify, generate, applyOverride } from "../lib/api";

  // Import child components
  import MediaSelector from "./MediaSelector.svelte";
  import PromptInput from "./PromptInput.svelte";
  import LoadingSpinner from "./Spinner.svelte";
  import ClassificationFeedback from "./ClassificationFeedback.svelte";
  import OverrideControls from "./OverrideControls.svelte";
  import ContentPreview from "./ContentPreview.svelte";
  import StatusDisplay from "./StatusDisplay.svelte";
  import PollingStatus from "./PollingStatus.svelte"; // CONFORM_02: UI for polling phase
  import Export from "./Export.svelte";

  let error = null;
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelayMs = [1000, 2000, 4000, 8000]; // Exponential backoff

  onMount(() => {
    // Initialize flow
    flowStore.reset();
    console.log("GenerateFlow mounted");
  });

  /**
   * Phase 1: Classify the prompt
   */
  async function handleGenerateClick() {
    const config = $flowStore.config || {};
    const { prompt, selectedMedium } = $flowStore;

    // Validate
    if (!prompt || prompt.trim().length < 10) {
      flowStore.setError({
        message: "Prompt must be at least 10 characters",
      });
      return;
    }

    if (!selectedMedium) {
      flowStore.setError({
        message: "Please select a medium",
      });
      return;
    }

    flowStore.startClassifying();
    retryCount = 0;

    try {
      // Call /api/classify
      const classResult = await withRetry(
        () => classify({ prompt, selectedMedium }),
        maxRetries,
        retryDelayMs
      );

      flowStore.setClassification(classResult.classification);
      flowStore.finishClassifying();

      // Auto-accept if high confidence
      const threshold =
        config.CONFIDENCE_THRESHOLD || 0.85;
      if (classResult.classification.confidence > threshold) {
        // Skip CLASSIFICATION_READY, go straight to GENERATING
        await handleAcceptClassification();
      } else {
        // Show user for review
        flowStore.transitionTo("CLASSIFICATION_READY");
      }
    } catch (err) {
      flowStore.finishClassifying();
      flowStore.setError(err, retryCount);
      error = err.message;
    }
  }

  /**
   * Phase 2: Generate content with classification
   */
  async function handleAcceptClassification() {
    const { prompt, classification, selectedMedium } = $flowStore;

    flowStore.startGenerating();
    retryCount = 0;

    try {
      // Step 1: Call /api/generate (returns 202 with resultId)
      const genResult = await withRetry(
        () =>
          generate({
            prompt,
            medium: selectedMedium || classification.medium,
            classification,
          }),
        maxRetries,
        retryDelayMs
      );

      // CONFORM_02: Step 2 - Transition to POLLING state instead of RESULT_READY
      flowStore.finishGenerating();
      flowStore.transitionTo("POLLING");
      console.log(
        `[CONFORM_02] Transitioned to POLLING for resultId: ${genResult.resultId}`
      );

      // CONFORM_02: Step 3 - Poll until job complete
      await pollUntilComplete(genResult.resultId);

      // CONFORM_02: Step 4 - Fetch actual content from result endpoint
      const content = await fetchContent(genResult.resultId);

      // CONFORM_02: Step 5 - Now transition to RESULT_READY with actual content
      flowStore.setResult({
        ...genResult,
        ...content, // pages, html, metadata, etc.
      });
      flowStore.transitionTo("RESULT_READY");
      console.log(`[CONFORM_02] Content ready, transitioned to RESULT_READY`);
    } catch (err) {
      flowStore.finishGenerating();
      flowStore.setError(err, retryCount);
      flowStore.transitionTo("ERROR");
      error = err.message;
      console.error(`[CONFORM_02] Error in generation/polling flow:`, err);
    }
  }

  /**
   * Phase 3: Apply override and regenerate
   */
  async function handleApplyOverride(overrideEvent) {
    const { detail: overrides } = overrideEvent;
    const { resultId, classification } = $flowStore;

    flowStore.startOverriding();
    retryCount = 0;

    try {
      // Call /api/override
      const overrideResult = await withRetry(
        () =>
          applyOverride({
            resultId,
            classification,
            overrides,
          }),
        maxRetries,
        retryDelayMs
      );

      // Update with override result
      if (overrideResult.result) {
        flowStore.setResult(overrideResult.result);
      }
      flowStore.setOverrideCost(overrideResult.costMultiplier);
      flowStore.finishOverriding();
      flowStore.transitionTo("RESULT_READY");
    } catch (err) {
      flowStore.finishOverriding();
      flowStore.setError(err, retryCount);
      // Stay in OVERRIDE_ACTIVE to allow retry
      error = err.message;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  async function withRetry(fn, maxAttempts, delays) {
    let lastError;
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        retryCount = attempt;

        if (attempt < maxAttempts && err.retryable !== false) {
          const delayMs = delays[attempt] || delays[delays.length - 1];
          console.log(
            `Retry attempt ${attempt + 1} after ${delayMs}ms`,
            err.message
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delayMs)
          );
        }
      }
    }
    throw lastError;
  }

  /**
   * CONFORM_02: Poll backend until job completes
   * Called after 202 response received
   * Transitions state to RESULT_READY when complete
   */
  async function pollUntilComplete(resultId) {
    const MAX_ATTEMPTS = 600; // 10 minutes at 1-second intervals
    const POLL_INTERVAL_MS = 1000; // 1 second between polls

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        // Fetch status from backend
        const statusResponse = await fetch(`/api/status/${resultId}`);

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }

        const statusData = await statusResponse.json();

        // Check for error state
        if (statusData.error) {
          throw new Error(statusData.error.message || "Job failed");
        }

        // Check for completion
        // Backend should indicate completion via one of:
        // - statusData.complete === true
        // - statusData.state === "complete"
        // - statusData.job_state === "complete"
        if (statusData.complete === true || statusData.state === "complete") {
          // Job complete, exit polling loop
          console.log(`[POLLING] Job complete: ${resultId}`);
          return;
        }

        // Optional: Update UI with progress
        if (statusData.progress) {
          flowStore.updateProgress({
            current: statusData.progress.current,
            total: statusData.progress.total,
            percent: statusData.progress.percent,
            message: statusData.progress.message,
          });
          console.log(
            `[POLLING] Progress: ${statusData.progress.percent}% (${statusData.progress.message})`
          );
        }

        // Optional: Update UI with ETA
        if (statusData.eta) {
          flowStore.updateETA(statusData.eta);
          console.log(
            `[POLLING] ETA: ${Math.round(statusData.eta / 1000)}s remaining`
          );
        }

        // Still processing, wait before next poll
        await new Promise((resolve) =>
          setTimeout(resolve, POLL_INTERVAL_MS)
        );
      } catch (err) {
        // Polling error (network, etc.)
        throw new Error(`Polling error: ${err.message}`);
      }
    }

    // Timeout: job did not complete within max attempts
    throw new Error("Job did not complete within 10 minutes");
  }

  /**
   * CONFORM_02: Fetch generated content from backend
   * Called after polling completes (job is done)
   */
  async function fetchContent(resultId) {
    const response = await fetch(`/api/result/${resultId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Content not found (expired or invalid)");
      }
      throw new Error(`Failed to retrieve content: ${response.status}`);
    }

    const data = await response.json();

    if (!data.content) {
      throw new Error("Invalid response: missing content");
    }

    console.log(`[POLLING] Content fetched for ${resultId}`);
    return data.content;
  }

  /**
   * Clear error and return to classification for retry
   */
  function handleRetryClassification() {
    flowStore.clearError();
    handleGenerateClick();
  }

  /**
   * Go back to medium selection
   */
  function handleReset() {
    flowStore.reset();
    error = null;
    retryCount = 0;
  }

  /**
   * Export the PDF
   */
  function handleExport() {
    const { pdfUrl } = $flowStore;
    if (pdfUrl) {
      // Download
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `generated-${$flowStore.resultId}.pdf`;
      link.click();
      flowStore.transitionTo("COMPLETE");
    }
  }

  // Unsubscribe on destroy
  let unsubscribe;
  onMount(() => {
    unsubscribe = flowStore.subscribe((_) => {
      // Reactive updates
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });
</script>

<div class="generate-flow">
  <!-- Status bar showing progress -->
  <div class="progress-bar">
    <div class="progress-fill" style="width: {$flowProgress}%"></div>
    <div class="progress-label">
      {#if $flowStore.state === "INITIAL"}
        Select medium to get started
      {:else if $flowStore.state === "MEDIUM_SELECTED"}
        Enter prompt and click Generate
      {:else if $flowStore.state === "GENERATING"}
        {#if $flowStore.isClassifying}
          Analyzing your prompt...
        {:else if $flowStore.isGenerating}
          Generating content...
        {:else if $flowStore.isOverriding}
          Applying overrides...
        {:else}
          Processing...
        {/if}
      {:else if $flowStore.state === "CLASSIFICATION_READY"}
        Review classification (accept or override)
      {:else if $flowStore.state === "RESULT_READY"}
        Content generated! Review or customize
      {:else if $flowStore.state === "OVERRIDE_ACTIVE"}
        Customize your content
      {:else if $flowStore.state === "COMPLETE"}
        Done!
      {/if}
    </div>
  </div>

  <!-- Error display -->
  {#if error}
    <div class="error-panel">
      <div class="error-message">{error}</div>
      <div class="error-actions">
        {#if $flowStore.state === "CLASSIFICATION_READY"}
          <button
            class="btn btn-primary"
            on:click={handleRetryClassification}
          >
            Retry Classification
          </button>
        {:else}
          <button class="btn btn-primary" on:click={handleReset}>
            Start Over
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Flow state: INITIAL or MEDIUM_SELECTED -->
  {#if $flowStore.state === "INITIAL" || $flowStore.state === "MEDIUM_SELECTED"}
    <div class="flow-section">
      <h2>Select a Medium</h2>
      <MediaSelector
        onMediaSelected={(e) => flowStore.setSelectedMedium(e.detail)}
      />
    </div>

    <div class="flow-section">
      <h2>Enter Your Prompt</h2>
      <PromptInput
        prompt={$flowStore.prompt}
        onPromptChange={(e) => flowStore.setPrompt(e.detail)}
        onGenerate={handleGenerateClick}
        disabled={$flowStore.isLoading}
      />
    </div>
  {/if}

  <!-- Flow state: GENERATING (show spinner) -->
  {#if $flowStore.state === "GENERATING"}
    <LoadingSpinner
      progress={$flowStore.isClassifying ? 30 : 70}
      message={$flowStore.isClassifying
        ? "Analyzing your prompt..."
        : "Generating your content..."}
    />
  {/if}

  <!-- Flow state: POLLING (show polling status with progress) -->
  <!-- CONFORM_02: New UI for job polling phase -->
  {#if $flowStore.state === "POLLING"}
    <div class="flow-section">
      <PollingStatus />
    </div>
  {/if}

  <!-- Flow state: CLASSIFICATION_READY (user review) -->
  {#if $flowStore.state === "CLASSIFICATION_READY" && $flowStore.classification}
    <div class="flow-section">
      <h2>Review Classification</h2>
      <ClassificationFeedback
        classification={$flowStore.classification}
        onAccept={handleAcceptClassification}
        onOverride={() => flowStore.transitionTo("OVERRIDE_ACTIVE")}
      />
    </div>
  {/if}

  <!-- Flow state: RESULT_READY (show content) -->
  {#if $flowStore.state === "RESULT_READY" && $flowStore.result}
    <div class="flow-section">
      <h2>Your Generated Content</h2>
      <ContentPreview
        pdfUrl={$flowStore.pdfUrl}
        pageCount={$flowStore.pageCount}
        latency={$flowStore.latency}
        medium={$flowStore.selectedMedium}
      />

      <StatusDisplay
        latency={$flowStore.latency}
        pageCount={$flowStore.pageCount}
        costEstimate={$flowStore.costEstimate}
        medium={$flowStore.selectedMedium}
      />

      <div class="action-buttons">
        <button class="btn btn-primary" on:click={handleExport}>
          Download PDF
        </button>
        <button
          class="btn btn-secondary"
          on:click={() => flowStore.transitionTo("OVERRIDE_ACTIVE")}
        >
          Customize Style
        </button>
        <button class="btn btn-outline" on:click={handleReset}>
          New Prompt
        </button>
      </div>
    </div>
  {/if}

  <!-- Flow state: OVERRIDE_ACTIVE (customize) -->
  {#if $flowStore.state === "OVERRIDE_ACTIVE"}
    <div class="flow-section">
      <h2>Customize Your Content</h2>
      <OverrideControls
        classification={$flowStore.classification}
        onApply={handleApplyOverride}
        onCancel={() => flowStore.transitionTo("RESULT_READY")}
        disabled={$flowStore.isOverriding}
      />
    </div>
  {/if}

  <!-- Flow state: COMPLETE -->
  {#if $flowStore.state === "COMPLETE"}
    <div class="flow-section completion">
      <h2>✓ Complete!</h2>
      <p>Your content has been generated and downloaded.</p>
      <button class="btn btn-primary" on:click={handleReset}>
        Create Another
      </button>
    </div>
  {/if}
</div>

<style>
  .generate-flow {
    max-width: 900px;
    margin: 2rem auto;
    padding: 1.5rem;
  }

  .progress-bar {
    position: relative;
    height: 40px;
    background: #f0f0f0;
    border-radius: 8px;
    margin-bottom: 2rem;
    overflow: hidden;
  }

  .progress-fill {
    position: absolute;
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    transition: width 0.3s ease;
  }

  .progress-label {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
    padding: 0 1rem;
    font-size: 0.95rem;
    font-weight: 500;
    color: #333;
    z-index: 1;
  }

  .flow-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
  }

  .flow-section h2 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    color: #1f2937;
  }

  .error-panel {
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .error-message {
    color: #c33;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .error-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: #6366f1;
    color: white;
  }

  .btn-primary:hover {
    background: #4f46e5;
  }

  .btn-secondary {
    background: #8b5cf6;
    color: white;
  }

  .btn-secondary:hover {
    background: #7c3aed;
  }

  .btn-outline {
    border: 1px solid #d1d5db;
    background: white;
    color: #1f2937;
  }

  .btn-outline:hover {
    background: #f9fafb;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .completion {
    text-align: center;
    padding: 3rem 1.5rem;
  }

  .completion p {
    font-size: 1.1rem;
    color: #666;
    margin: 1rem 0;
  }
</style>
