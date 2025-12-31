/**
 * Phase B eBook API Client
 * HTTP client for Phase B backend endpoints
 * Handles request/response serialization, error handling, timeouts
 */

const CONFIG = {
  API_BASE_URL: "/api",
  TIMEOUTS: {
    GENERATE: 600000, // 600s (10min) for generate - Large ebooks (20 pages) can take 5+ minutes with Gemini
    OVERRIDE: 10000, // 10s for override
    THEMES: 5000, // 5s for themes
  },
};

/**
 * Fetch with timeout and error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} Response JSON
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(
      `[API] Starting fetch to ${url.replace(CONFIG.API_BASE_URL, "")}`
    );
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    console.log(
      `[API] Response received - Status: ${
        response.status
      }, Content-Type: ${response.headers.get("content-type")}`
    );
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      console.log(
        `[API] Content-Length header: ${(
          parseInt(contentLength) / 1024
        ).toFixed(2)}KB`
      );
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error || `API error ${response.status}: ${response.statusText}`
      );
    }

    // Parse response with detailed error handling
    try {
      console.log(`[API] Attempting to parse JSON response...`);
      const text = await response.text();
      console.log(`[API] Raw response text length: ${text.length} bytes`);
      console.log(`[API] First 200 chars: ${text.substring(0, 200)}`);
      console.log(`[API] Last 100 chars: ${text.substring(text.length - 100)}`);

      const data = JSON.parse(text);
      console.log(
        `[API] JSON parsed successfully. Result keys: ${Object.keys(data).join(
          ", "
        )}`
      );
      if (data.out_envelope?.html) {
        console.log(
          `[API] HTML content length: ${(
            data.out_envelope.html.length / 1024
          ).toFixed(2)}KB`
        );
      }
      if (data.out_envelope?.pages && Array.isArray(data.out_envelope.pages)) {
        console.log(`[API] Pages count: ${data.out_envelope.pages.length}`);
      }
      return data;
    } catch (parseErr) {
      console.error(`[API] JSON parse error:`, parseErr);
      console.error(`[API] Parse error details:`, {
        name: parseErr.name,
        message: parseErr.message,
        stack: parseErr.stack,
      });
      throw parseErr;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    if (err instanceof TypeError) {
      console.error(`[API] TypeError caught:`, err.message);
      throw new Error(`Network error: ${err.message}`);
    }
    console.error(`[API] Error:`, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST /api/ebook/generate
 * Generate eBook with Phase B pipeline
 * @param {Object} payload - { prompt, theme, pageCount, options }
 * @returns {Promise<Object>} Generated eBook result
 */
export async function generateEbook(payload) {
  return fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/ebook/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    CONFIG.TIMEOUTS.GENERATE
  );
}

/**
 * POST /api/override
 * Apply fast-path style overrides
 * @param {Object} payload - { ebookId, overrides }
 * @returns {Promise<Object>} Updated eBook result
 */
export async function applyOverride(payload) {
  return fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/override`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    CONFIG.TIMEOUTS.OVERRIDE
  );
}

/**
 * GET /api/themes
 * Fetch available themes and color palettes metadata
 * @returns {Promise<Object>} { themes, colorPalettes }
 */
export async function fetchThemes() {
  return fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/themes`,
    { method: "GET" },
    CONFIG.TIMEOUTS.THEMES
  );
}
