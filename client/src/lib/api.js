import Logger from "./logger";
import { get } from "svelte/store";
import { promptStore } from "../stores/promptStore.js";
import { modeStore } from "../stores/modeStore.js";

// API utilities with retry logic
const DEFAULT_CONFIG = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 10000,
  // Do NOT retry on 401 by default — auth failures should surface immediately.
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

async function fetchWithRetry(url, options = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...options.retryConfig,
  };
  delete options.retryConfig;

  // Resolve a safe base for relative URLs. In test or Node environments
  // window.location.origin may be missing or undici may reject relative URLs,
  // so fall back to http://localhost to ensure fetch receives an absolute URL.
  const base =
    typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin
      : "http://localhost";
  const resolved = new URL(url, base);
  const endpoint = resolved.pathname;
  const method = options.method || "GET";

  Logger.apiRequest(endpoint, method, {
    config,
    headers: options.headers,
  });

  let lastError;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      // Use an absolute URL when calling fetch to avoid runtime errors in Node/undici
      const response = await fetch(resolved.href, options);

      // Log the response
      Logger.apiResponse(endpoint, response.status, {
        attempt,
        ok: response.ok,
      });

      // Successful response
      if (response.ok) return response;

      // Check if we should retry based on status
      if (config.retryableStatuses.includes(response.status)) {
        if (attempt < config.maxRetries) {
          // Calculate backoff with jitter
          const backoff = Math.min(
            config.maxBackoffMs,
            config.initialBackoffMs * Math.pow(2, attempt - 1)
          );
          const jitter = Math.random() * 100;
          const nextAttemptIn = Math.round((backoff + jitter) / 1000);

          Logger.apiRetry(endpoint, attempt, config.maxRetries, {
            status: response.status,
            nextAttemptIn,
          });

          await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
          continue;
        }
      }

      return response;
    } catch (error) {
      // If the request was aborted, do not retry — rethrow immediately.
      // Aborts are expected when the app cancels in-flight requests (for
      // example when starting a new preview). Treat these as debug-level
      // events instead of errors to avoid noisy error logs.
      if (error && (error.name === "AbortError" || error.type === "aborted")) {
        Logger.debug(`API Abort: ${endpoint}`, {
          type: "api_abort",
          endpoint,
          attempt,
          maxRetries: config.maxRetries,
          // preserve the original error for local inspection when needed
          error,
        });
        throw error;
      }

      lastError = error;

      Logger.apiError(endpoint, error, {
        attempt,
        maxRetries: config.maxRetries,
      });

      if (attempt === config.maxRetries) throw error;

      const backoff = Math.min(
        config.maxBackoffMs,
        config.initialBackoffMs * Math.pow(2, attempt - 1)
      );

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError;
}

// API endpoints
export async function submitPrompt(payloadOrPrompt) {
  Logger.debug("Submitting prompt", { payloadOrPrompt });

  try {
    // Build canonical payload from argument or stores
    const ps = get(promptStore);
    const ms = get(modeStore);

    const payload =
      typeof payloadOrPrompt === "object" && payloadOrPrompt !== null
        ? payloadOrPrompt
        : {
            mode: (ms && ms.current) || (ps && ps.mode) || "basic",
            prompt:
              typeof payloadOrPrompt === "string"
                ? payloadOrPrompt
                : (ps && ps.prompt) || "",
            metadata: (ps && ps.metadata) || {},
            options: (ps && ps.options) || {},
          };

    Logger.debug("submitPrompt: sending payload", { payload });

    const response = await fetchWithRetry("/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Use default retry behaviour; do not retry on 401 so auth errors
      // are surfaced to the UI immediately.
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const code = json?.error || "UNKNOWN_ERROR";
      const message = json?.message || `HTTP ${response.status}`;
      const fields = json?.fields;
      Logger.error("Prompt submission failed", { code, message, fields });
      throw { type: "server", code, message, fields };
    }

    // Expect canonical envelope only
    const envelope = json?.out_envelope;
    if (!envelope || !Array.isArray(envelope.pages)) {
      Logger.error("Invalid server response shape", { envelope });
      throw {
        type: "server",
        code: "INVALID_RESPONSE",
        message: "Server response missing canonical out_envelope.pages",
      };
    }

    Logger.info("Prompt submitted successfully", {
      pages: (envelope.pages || []).length,
    });
    return envelope;
  } catch (error) {
    Logger.error("Prompt submission error", { error });
    throw error;
  }
}

export async function loadPreview(content, options = {}) {
  Logger.debug("Loading preview", {
    contentKeys: content ? Object.keys(content) : "no content",
  });
  const signal = options && options.signal;

  // Ensure content has required structure
  // If content references a resultId or promptId, resolve it first using
  // helper endpoints added on the server: /content/result/:id and /content/prompt/:id
  try {
    // If the content references a stored result/prompt id, prefer fetching the
    // rendered HTML directly via /preview?resultId= or /preview?promptId= which
    // the dev server proxies to the backend. This avoids relying on /content
    // helper endpoints which may not be proxied by the frontend dev server.
    if (content && content.resultId) {
      if (import.meta.env.DEV)
        console.debug(
          "[DEV] loadPreview: attempting /preview?resultId=",
          content.resultId
        );
      const resp = await fetchWithRetry(
        `/preview?resultId=${encodeURIComponent(content.resultId)}`,
        { retryConfig: { maxRetries: 2 }, signal }
      );
      if (resp && resp.ok) {
        const html = await resp.text();
        Logger.info("Loaded preview by resultId", {
          resultId: content.resultId,
          length: html.length,
        });
        if (import.meta.env.DEV)
          console.debug(
            "[DEV] loadPreview: /preview?resultId returned HTML length=",
            html.length
          );
        return html;
      } else {
        if (import.meta.env.DEV)
          console.debug(
            "[DEV] loadPreview: /preview?resultId returned",
            resp && resp.status
          );
      }
    }

    if (content && content.promptId) {
      if (import.meta.env.DEV)
        console.debug(
          "[DEV] loadPreview: attempting /preview?promptId=",
          content.promptId
        );
      const resp = await fetchWithRetry(
        `/preview?promptId=${encodeURIComponent(content.promptId)}`,
        { retryConfig: { maxRetries: 2 }, signal }
      );
      if (resp && resp.ok) {
        const html = await resp.text();
        Logger.info("Loaded preview by promptId", {
          promptId: content.promptId,
          length: html.length,
        });
        if (import.meta.env.DEV)
          console.debug(
            "[DEV] loadPreview: /preview?promptId returned HTML length=",
            html.length
          );
        return html;
      } else {
        if (import.meta.env.DEV)
          console.debug(
            "[DEV] loadPreview: /preview?promptId returned",
            resp && resp.status
          );
      }
    }

    // Fallback: if /preview by id didn't work, try loading JSON content via
    // the helper endpoints and continue with the normal preview flow.
    if (content && (content.resultId || content.promptId)) {
      if (content.resultId) {
        const resp = await fetchWithRetry(
          `/content/result/${encodeURIComponent(content.resultId)}`,
          { signal }
        );
        if (resp && resp.ok) {
          const json = await resp.json();
          content = { ...(json.content || {}), resultId: content.resultId };
        }
      } else if (content.promptId) {
        const resp = await fetchWithRetry(
          `/content/prompt/${encodeURIComponent(content.promptId)}`,
          { signal }
        );
        if (resp && resp.ok) {
          const json = await resp.json();
          content = { ...(json.content || {}), promptId: content.promptId };
        }
      }
    }

    if (!content || !content.title || !content.body) {
      const error = new Error("Preview content must include title and body");
      Logger.error("Preview validation failed", {
        error,
        providedFields: content ? Object.keys(content) : [],
        required: ["title", "body"],
      });
      throw error;
    }
  } catch (err) {
    // If the resolution was aborted, treat as a debug-level event and
    // rethrow so callers (like previewFromContent) can handle it.
    if (err && (err.name === "AbortError" || err.type === "aborted")) {
      Logger.debug("Content resolution aborted", {
        type: "api_abort",
        error: err,
      });
      throw err;
    }

    Logger.error("Failed to resolve content by id", { err });
    throw err;
  }

  try {
    const formattedContent = {
      title: content.title,
      body: content.body,
      layout: content.layout || "default",
    };

    Logger.debug("Requesting preview", { formattedContent });

    const payloadStr = JSON.stringify(formattedContent);
    let response;

    // For large payloads, prefer POST /api/preview which returns JSON { preview }
    if (payloadStr.length > 2000) {
      response = await fetchWithRetry("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr,
        retryConfig: { maxRetries: 3, retryableStatuses: [500, 503] },
        signal,
      });
      if (!response.ok) {
        const error = new Error(`Preview failed: ${response.status}`);
        Logger.error("Preview request failed", {
          error,
          status: response.status,
        });
        throw error;
      }
      const json = await response.json();
      const previewHtml = json.preview || "";
      Logger.info("Preview loaded successfully", {
        contentLength: previewHtml.length,
        layout: formattedContent.layout,
      });
      return previewHtml;
    }

    // Small payloads: use GET /preview query param for quickness
    response = await fetchWithRetry(
      `/preview?content=${encodeURIComponent(payloadStr)}`,
      {
        retryConfig: {
          maxRetries: 3,
          retryableStatuses: [500, 503],
        },
        signal,
      }
    );

    if (!response.ok) {
      const error = new Error(`Preview failed: ${response.status}`);
      Logger.error("Preview request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const previewHtml = await response.text();
    Logger.info("Preview loaded successfully", {
      contentLength: previewHtml.length,
      layout: formattedContent.layout,
    });
    return previewHtml;
  } catch (error) {
    // Treat aborts as non-errors: callers expect AbortError to be thrown
    // so they can decide whether to ignore it (e.g. previewFromContent).
    if (error && (error.name === "AbortError" || error.type === "aborted")) {
      Logger.debug("Preview request aborted", {
        type: "api_abort",
        error,
      });
      throw error;
    }

    Logger.error("Preview loading error", { error });
    throw error;
  }
}

export async function saveOverride(content, changes) {
  Logger.debug("Saving override", {
    originalContent: content ? Object.keys(content) : "no content",
    changeKeys: changes ? Object.keys(changes) : "no changes",
  });

  try {
    const response = await fetchWithRetry("/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, changes }),
      retryConfig: {
        maxRetries: 3,
        retryableStatuses: [500, 503], // Server errors most likely for override
      },
    });

    if (!response.ok) {
      const error = new Error(`Override failed: ${response.status}`);
      Logger.error("Override request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const result = await response.json();
    Logger.info("Override saved successfully", {
      changedFields: changes ? Object.keys(changes) : [],
    });
    return result;
  } catch (error) {
    Logger.error("Override save error", { error });
    throw error;
  }
}

export async function exportToPdf(content) {
  Logger.debug("Exporting to PDF", {
    contentKeys: content ? Object.keys(content) : "no content",
  });

  // Validate canonical envelope format (pages/metadata/actions)
  if (!content || !Array.isArray(content.pages)) {
    const error = new Error(
      "Export content must be a canonical envelope with pages array"
    );
    Logger.error("Export validation failed", { error });
    throw error;
  }

  try {
    const response = await fetchWithRetry("/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });

    if (!response.ok) {
      const error = new Error(`Export failed: ${response.status}`);
      Logger.error("Export request failed", { error, status: response.status });
      throw error;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AetherPress-Export-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    Logger.info("PDF exported successfully");
  } catch (error) {
    Logger.error("PDF export error", { error });
    throw error;
  }
}

// Persist generated prompt/content to server-backed prompts API
export async function savePromptContent(content) {
  // content is expected to be an object with title/body and optionally prompt
  try {
    const response = await fetchWithRetry("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: content.prompt || content.title || "" }),
    });
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
    const data = await response.json();
    // server returns { success: true, data: result }
    return data && data.data ? data.data : data;
  } catch (err) {
    Logger.error("savePromptContent error", { err });
    throw err;
  }
}

export async function updatePromptContent(id, content) {
  try {
    const response = await fetchWithRetry(
      `/api/prompts/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content.prompt || content.title || "" }),
      }
    );
    if (!response.ok) throw new Error(`Update failed: ${response.status}`);
    const data = await response.json();
    return data && data.data ? data.data : data;
  } catch (err) {
    Logger.error("updatePromptContent error", { err });
    throw err;
  }
}

// Background export job API helpers
export async function startExportJob(content) {
  if (!content || !content.title || !content.body) {
    throw new Error("Export content must include title and body");
  }

  const response = await fetchWithRetry("/api/export/job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
  if (!response.ok)
    throw new Error(`Failed to start export job: ${response.status}`);
  return response.json(); // { jobId }
}

export async function getExportJobStatus(jobId) {
  if (!jobId) throw new Error("jobId required");
  const response = await fetchWithRetry(
    `/api/export/job/${encodeURIComponent(jobId)}`,
    {}
  );
  if (!response.ok)
    throw new Error(`Failed to fetch job status: ${response.status}`);
  return response.json();
}

// ========================================
// Phase A-B: Classification + Routing API
// ========================================

/**
 * Classify a prompt to extract medium, style, theme, audience, etc.
 * Returns classification with confidence score and source (rules/ai/hybrid)
 */
export async function classify(prompt, options = {}) {
  Logger.debug("Classifying prompt", { promptLength: prompt?.length });

  try {
    const response = await fetchWithRetry("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, options }),
      retryConfig: { maxRetries: 2 },
    });

    if (!response.ok) {
      const error = new Error(`Classification failed: ${response.status}`);
      Logger.error("Classification request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const result = await response.json();
    Logger.info("Prompt classified successfully", {
      medium: result.medium,
      confidence: result.confidence,
      source: result.source,
    });
    return result;
  } catch (error) {
    Logger.error("Classification error", { error });
    throw error;
  }
}

/**
 * Generate content for a prompt with specified medium and options
 * Internally calls genieRouter to route to appropriate service
 */
export async function generate(prompt, medium = "ebook", options = {}) {
  Logger.debug("Generating content", { prompt: prompt?.slice(0, 50), medium });

  try {
    const response = await fetchWithRetry("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        medium,
        options,
      }),
      retryConfig: { maxRetries: 2 },
    });

    if (!response.ok) {
      const error = new Error(`Generation failed: ${response.status}`);
      Logger.error("Generation request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const result = await response.json();
    Logger.info("Content generated successfully", {
      medium: result.medium,
      latency: result.latency,
      confidence: result.confidence,
    });
    return result;
  } catch (error) {
    Logger.error("Generation error", { error });
    throw error;
  }
}

/**
 * Apply override to change style, color, or medium after generation
 * Calls override system API for cost-aware transformations
 */
export async function applyOverride(
  output,
  oldClassification,
  newClassification
) {
  Logger.debug("Applying override", {
    oldMedium: oldClassification?.medium,
    newMedium: newClassification?.medium,
  });

  try {
    const response = await fetchWithRetry("/api/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        output,
        oldClassification,
        newClassification,
      }),
      retryConfig: { maxRetries: 2 },
    });

    if (!response.ok) {
      const error = new Error(`Override failed: ${response.status}`);
      Logger.error("Override request failed", {
        error,
        status: response.status,
      });
      throw error;
    }

    const result = await response.json();
    Logger.info("Override applied successfully", {
      costMultiplier: result.costMultiplier,
      changedDimensions: result.changedDimensions,
    });
    return result;
  } catch (error) {
    Logger.error("Override error", { error });
    throw error;
  }
}

/**
 * Get available services (mediums) from router
 */
export async function getAvailableServices() {
  Logger.debug("Fetching available services");

  try {
    const response = await fetchWithRetry("/api/router/services", {
      retryConfig: { maxRetries: 2 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch services: ${response.status}`);
    }

    const services = await response.json();
    Logger.info("Services fetched", { count: services?.length });
    return services;
  } catch (error) {
    Logger.error("Failed to fetch services", { error });
    throw error;
  }
}

/**
 * Get capabilities (styles, themes) for a specific medium
 */
export async function getServiceCapabilities(medium) {
  Logger.debug("Fetching capabilities", { medium });

  try {
    const response = await fetchWithRetry(
      `/api/router/capabilities/${encodeURIComponent(medium)}`,
      { retryConfig: { maxRetries: 2 } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch capabilities: ${response.status}`);
    }

    const capabilities = await response.json();
    Logger.info("Capabilities fetched", {
      medium,
      styles: capabilities?.styles?.length,
    });
    return capabilities;
  } catch (error) {
    Logger.error("Failed to fetch capabilities", { error });
    throw error;
  }
}

/**
 * Check if override from one medium to another is possible
 */
export async function canTransform(fromMedium, toMedium) {
  Logger.debug("Checking transform compatibility", { fromMedium, toMedium });

  try {
    const response = await fetchWithRetry("/api/override/can-transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromMedium, toMedium }),
      retryConfig: { maxRetries: 2 },
    });

    if (!response.ok) {
      throw new Error(`Failed to check transform: ${response.status}`);
    }

    const result = await response.json();
    Logger.info("Transform compatibility checked", {
      fromMedium,
      toMedium,
      can: result.can,
    });
    return result.can;
  } catch (error) {
    Logger.error("Failed to check transform", { error });
    throw error;
  }
}

/**
 * Get compatible styles for a given medium
 */
export async function getCompatibleStyles(medium) {
  Logger.debug("Fetching compatible styles", { medium });

  try {
    const response = await fetchWithRetry(
      `/api/override/compatible-styles/${encodeURIComponent(medium)}`,
      { retryConfig: { maxRetries: 2 } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch compatible styles: ${response.status}`);
    }

    const styles = await response.json();
    Logger.info("Compatible styles fetched", { medium, count: styles?.length });
    return styles;
  } catch (error) {
    Logger.error("Failed to fetch compatible styles", { error });
    throw error;
  }
}

/**
 * GET /api/status/:resultId
 * Poll for job status and progress
 * @param {string} resultId - The job ID
 * @returns {Promise<Object>} { status, eta, calls_completed, calls_total, progress_percent, message }
 */
export async function getStatus(resultId) {
  try {
    const response = await fetchWithRetry(`/api/status/${resultId}`, {
      method: "GET",
      retryConfig: { maxRetries: 2 },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Job not found: ${resultId}`);
      }
      throw new Error(`Failed to get status: ${response.status}`);
    }

    const status = await response.json();
    Logger.debug("Status fetched", { resultId, status: status.status });
    return status;
  } catch (error) {
    Logger.error("Failed to get status", { error, resultId });
    throw error;
  }
}

/**
 * GET /api/result/:resultId
 * Fetch full result content when job is complete
 * @param {string} resultId - The job ID
 * @returns {Promise<Object>} { status, content } where content = { pages, html, metadata, ... }
 */
export async function getResult(resultId) {
  try {
    const response = await fetchWithRetry(`/api/result/${resultId}`, {
      method: "GET",
      retryConfig: { maxRetries: 2 },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Job not found: ${resultId}`);
      }
      if (response.status === 202) {
        const data = await response.json();
        const error = new Error("Job still processing");
        error.status = 202;
        error.progress = data;
        throw error;
      }
      throw new Error(`Failed to get result: ${response.status}`);
    }

    const result = await response.json();
    Logger.info("Result fetched", { resultId, status: result.status });
    return result;
  } catch (error) {
    Logger.error("Failed to get result", { error, resultId });
    throw error;
  }
}
