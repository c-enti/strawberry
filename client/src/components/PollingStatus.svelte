<script>
  /**
   * PollingStatus.svelte - CONFORM_02
   * Displays UI during the polling phase while backend job is processing
   * Shows progress, ETA, and encouraging message to user
   */

  import { flowStore } from "../lib/stores/flowStore.js";

  let pollingProgress;
  let pollingETA;
  let displayETA = "";

  // Subscribe to polling progress and ETA from store
  flowStore.subscribe(($flowStore) => {
    pollingProgress = $flowStore.pollingProgress;
    pollingETA = $flowStore.pollingETA;

    // Format ETA for display
    if (pollingETA && pollingETA > 0) {
      const seconds = Math.round(pollingETA / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        displayETA = `${minutes}m ${remainingSeconds}s remaining`;
      } else {
        displayETA = `${seconds}s remaining`;
      }
    } else {
      displayETA = "";
    }
  });
</script>

<div class="polling-container">
  <!-- Spinner Animation -->
  <div class="spinner-wrapper">
    <div class="spinner"></div>
  </div>

  <!-- Main Message -->
  <h2 class="message">🔄 Working on it...</h2>

  <!-- Status Description -->
  <p class="description">Generating your content</p>

  <!-- Progress Bar -->
  {#if pollingProgress}
    <div class="progress-section">
      <div class="progress-info">
        <span class="percent">{pollingProgress.percent || 0}%</span>
        {#if pollingProgress.message}
          <span class="step-message">{pollingProgress.message}</span>
        {/if}
      </div>
      <div class="progress-bar-container">
        <div
          class="progress-bar-fill"
          style="width: {pollingProgress.percent || 0}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- ETA Display -->
  {#if displayETA}
    <p class="eta">ETA: {displayETA}</p>
  {/if}

  <!-- Motivational Text -->
  <p class="note">This may take a few moments...</p>
</div>

<style>
  .polling-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 12px;
    text-align: center;
    min-height: 300px;
    gap: 1rem;
  }

  .spinner-wrapper {
    margin-bottom: 1rem;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(22, 160, 133, 0.2);
    border-top-color: #16a085;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .message {
    font-size: 1.5rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 0;
  }

  .description {
    font-size: 1rem;
    color: #34495e;
    margin: 0.5rem 0;
  }

  .progress-section {
    width: 100%;
    max-width: 300px;
    margin: 1rem 0;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: #555;
  }

  .percent {
    font-weight: 600;
    color: #16a085;
  }

  .step-message {
    font-size: 0.8rem;
    color: #7f8c8d;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .progress-bar-container {
    width: 100%;
    height: 8px;
    background-color: rgba(22, 160, 133, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background-color: #16a085;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .eta {
    font-size: 0.875rem;
    color: #7f8c8d;
    margin: 0.5rem 0;
    font-style: italic;
  }

  .note {
    font-size: 0.8rem;
    color: #95a5a6;
    margin-top: 0.5rem;
    margin-bottom: 0;
  }

  @media (max-width: 600px) {
    .polling-container {
      padding: 1.5rem;
      min-height: 250px;
    }

    .message {
      font-size: 1.25rem;
    }

    .description {
      font-size: 0.9rem;
    }
  }
</style>
