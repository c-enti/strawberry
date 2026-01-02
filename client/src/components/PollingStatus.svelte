<script>
  import { flowStore } from "../lib/stores/flowStore.js";
  import Spinner from "./Spinner.svelte";

  $: ({ currentProgressPercent, currentEta, calls_completed, calls_total } = $flowStore);
</script>

<div class="polling-status">
  <div class="polling-header">
    <Spinner size={24} ariaLabel="Processing content" />
    <h3>Working on your content...</h3>
  </div>

  <div class="progress-section">
    <div class="progress-bar-container">
      <div 
        class="progress-bar-fill" 
        style="width: {currentProgressPercent || 0}%"
        role="progressbar"
        aria-valuenow={currentProgressPercent || 0}
        aria-valuemin="0"
        aria-valuemax="100"
      ></div>
    </div>
    <div class="progress-text">
      {currentProgressPercent || 0}% complete
    </div>
  </div>

  <div class="steps-section">
    <div class="steps-info">
      Step {calls_completed || 0} of {calls_total || 0}
    </div>
  </div>

  <div class="eta-section">
    {#if currentEta !== null && currentEta !== undefined}
      <div class="eta-display">
        {#if currentEta > 0}
          <span>Estimated time: <strong>{currentEta}s</strong></span>
        {:else}
          <span>Almost done...</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="message-section">
    <p class="message-text">This may take a minute or two. Please don't close this window.</p>
  </div>
</div>

<style>
  .polling-status {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    color: white;
    text-align: center;
  }

  .polling-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .polling-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .progress-bar-container {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .steps-section {
    display: flex;
    justify-content: center;
  }

  .steps-info {
    font-size: 0.875rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem 1rem;
    border-radius: 4px;
  }

  .eta-section {
    display: flex;
    justify-content: center;
  }

  .eta-display {
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .message-section {
    margin-top: 0.5rem;
  }

  .message-text {
    margin: 0;
    font-size: 0.875rem;
    opacity: 0.85;
  }
</style>
