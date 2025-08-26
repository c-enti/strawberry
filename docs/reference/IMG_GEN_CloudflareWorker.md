<!--
TODO (incremental, reversible hardening for server/scripts/poem-to-image-cloudflare.js)

Day 1 (already applied): Soft env warnings
- Purpose: warn when env vars are placeholders (non-blocking).
- Revert: restore original file from docs reference or git restore.

Day 2: Add opt-in toggle `IMAGE_HARDEN=true`
- Purpose: gate further hardening behind an opt-in flag so default behavior is unchanged.
- Revert: checkout the file from main or delete branch.

Day 3: Add fetch timeout + single retry (gated)
- Purpose: reduce transient failures without changing default behavior.
- Revert: restore file from git.

Day 4: Validate Cloudflare `Content-Type` before writing image (gated)
- Purpose: avoid writing HTML/error to .png files.

Day 5: Safe atomic write for image (.tmp -> rename)

Day 6: Light moderation/safety check on visual prompt (gated)

Day 7: Add an integration test that mocks Gemini and Cloudflare (optional file)

Notes:
- Use `server/scripts/poem-to-image-cloudflare.js` as the single source of truth for code; this document documents the script.
- Revert commands examples:
  - Restore script from main: `git checkout main -- server/scripts/poem-to-image-cloudflare.js`
  - Discard local branch: `git branch -D feat/image-gen-hardening-dayN`
  - Create a feature branch for a day: `git switch -c feat/image-gen-hardening-dayN`

End TODO -->

Using Cloudflare Workers AI for image generation is a fantastic alternative for prototyping. It's often faster, has a very generous free tier, and is incredibly simple to call.

### The Two Parts of the Solution

1.  **Cloudflare Setup:** You'll need to get your Cloudflare Account ID and generate an API Token.
2.  **Code Update:** We'll modify the `poem-to-image-cloudflare.js` script in server/scripts/ to call the Cloudflare API endpoint.

---

### Step 1: Get Your Cloudflare Credentials

You only need to do this once.

1.  **Log in to your Cloudflare Dashboard.** If you don't have an account, you can sign up for free.

2.  **Find Your Account ID:**

    - On the home page of the dashboard, look at the URL in your browser's address bar. It will be something like `https://dash.cloudflare.com/ACCOUNT_ID`.
    - Alternatively, select any of your domains, and you can find the Account ID on the right-hand sidebar of the "Overview" page.
    - Copy this ID. You will need it for the API endpoint URL.

3.  **Create an API Token:**
    - From the dashboard home, click on the user icon in the top right and select "My Profile".
    - Go to the "API Tokens" tab on the left.
    - Click "Create Token".
    - Find the "Edit Cloudflare Workers" template and click "Use template".
    - You can leave the permissions as they are, but for better security, under "Account Resources", select your specific account. Under "Zone Resources", you can select "All zones" or a specific one if you prefer. The key permission it needs is **Workers AI**.
    - Continue to summary and click "Create Token".
    - **Copy the generated token immediately.** You will not be able to see it again.

---

### Step 2: Updated Code for Cloudflare AI

Save the following code as `poem-to-image-cloudflare.js`.

The key difference is in the `generateWithCloudflare` function. Cloudflare's API directly returns the raw image file (`image/png`), not a JSON object with a base64 string. Our code handles this more direct response.

```javascript
// poem-to-image-cloudflare.js

import fetch from "node-fetch";
import fs from "fs";

// --- Type definitions for API responses ---
/** @typedef {Object} GeminiError {
 *   error: {
 *     code: number,
 *     message: string,
 *     status: string
 *   }
 * } */

/** @typedef {Object} GeminiContent {
 *   parts: Array<{text: string}>
 * } */

/** @typedef {Object} GeminiCandidate {
 *   content: GeminiContent,
 *   finishReason: string
 * } */

/** @typedef {Object} GeminiResponse {
 *   candidates: GeminiCandidate[]
 * } */

// --- CONFIGURATION: Replace with your actual Gemini and Cloudflare details ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
const GEMINI_API_URL = process.env.GEMINI_API_URL || "YOUR_GEMINI_API_URL";
const CLOUDFLARE_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "YOUR_CLOUDFLARE_ACCOUNT_ID";
const CLOUDFLARE_API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN || "YOUR_CLOUDFLARE_API_TOKEN";
// --------------------------------------------------------------------------

// Soft environment validation (non-blocking) — warns when placeholders or missing values are detected.
function validateEnvSoft() {
  const placeholders = [];
  if (!GEMINI_API_URL || GEMINI_API_URL.includes("YOUR_GEMINI_API_URL"))
    placeholders.push("GEMINI_API_URL");
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_GEMINI_API_KEY"))
    placeholders.push("GEMINI_API_KEY");
  if (
    !CLOUDFLARE_ACCOUNT_ID ||
    CLOUDFLARE_ACCOUNT_ID.includes("YOUR_CLOUDFLARE_ACCOUNT_ID")
  )
    placeholders.push("CLOUDFLARE_ACCOUNT_ID");
  if (
    !CLOUDFLARE_API_TOKEN ||
    CLOUDFLARE_API_TOKEN.includes("YOUR_CLOUDFLARE_API_TOKEN")
  )
    placeholders.push("CLOUDFLARE_API_TOKEN");

  if (placeholders.length > 0) {
    console.warn(
      "\n[env] The following environment variables appear missing or are still placeholders: " +
        placeholders.join(", ")
    );
    console.warn(
      "[env] This script can run in local fallback modes, but for full connectivity provide real credentials."
    );
    console.warn("[env] Example: export GEMINI_API_KEY=your_token_here");
    console.warn(
      "[env] If you intentionally want to run without cloud services, ignore this warning.\n"
    );
  }
}

/**
 * A generic function to call the Gemini API.
 * @param {string} prompt - The text prompt to send.
 * @returns {Promise<string>} The generated text from the model.
 */
async function generateWithGemini(prompt) {
  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  });

  try {
    const response = await fetch(url, { method: "POST", headers, body });
    if (!response.ok) {
      /** @type {GeminiError} */
      const errorData = await response.json();
      if (errorData && typeof errorData === "object" && "error" in errorData) {
        throw new Error(`Gemini API Error: ${JSON.stringify(errorData.error)}`);
      }
      throw new Error(`Gemini API Error: Unknown error structure`);
    }

    /** @type {GeminiResponse} */
    const data = await response.json();

    // Type-safe access with runtime validation
    if (!data || !Array.isArray(data.candidates)) {
      throw new Error(
        "Invalid API response structure: missing candidates array"
      );
    }

    const textContent = data.candidates[0]?.content?.parts?.[0]?.text;

    if (textContent) {
      return textContent;
    } else {
      // This handles cases where the response is successful but empty (e.g., due to safety filters)
      // or has an unexpected structure.
      console.error(
        "Unexpected response structure from Gemini API:",
        JSON.stringify(data, null, 2)
      );
      throw new Error("Could not extract text from Gemini API response.");
    }
    // --- ROBUSTNESS FIX ENDS HERE ---
  } catch (error) {
    console.error("Error calling Gemini API:", error.message);
    throw error; // Re-throw the error so the main function knows to stop
  }
}

/**
 * Calls the Cloudflare Workers AI API to generate an image.
 * @param {string} prompt - The visual prompt for the image.
 * @returns {Promise<Buffer>} A buffer containing the generated PNG image data.
 */
async function generateWithCloudflare(prompt) {
  // This is the model we'll use. Cloudflare offers several.
  const model = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

  const headers = {
    Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({ prompt });

  try {
    const response = await fetch(url, { method: "POST", headers, body });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API Error: ${response.status} ${errorText}`);
    }

    // IMPORTANT: Cloudflare returns the raw image data directly, not JSON.
    // We need to get it as an ArrayBuffer and then convert it to a Node.js Buffer.
    const imageArrayBuffer = await response.arrayBuffer();
    return Buffer.from(imageArrayBuffer);
  } catch (error) {
    console.error("Error calling Cloudflare AI API:", error);
    throw error;
  }
}

/**
 * Main function to run the full poem-to-image workflow.
 */
async function main() {
  console.log("--- Step 1: Generating a poem... ---");
  const poemTheme =
    "an ancient, moss-covered robot sleeping in a sunlit forest clearing.";
  const poemGenerationPrompt = `Write a short, evocative, six-line poem about "${poemTheme}". Use rich, visual language.`;

  const poem = await generateWithGemini(poemGenerationPrompt);
  console.log("Generated Poem:\n---\n" + poem + "\n---");

  console.log("\n--- Step 2: Creating a visual prompt from the poem... ---");
  const imagePromptGenerationPrompt = `
    Based on the following poem, create a highly detailed and descriptive prompt for an AI image generator.
    Focus on the mood, lighting, style, and specific visual elements. The prompt should be a single paragraph.

    Poem:
    ${poem}
  `;

  const visualPrompt = await generateWithGemini(imagePromptGenerationPrompt);
  console.log("Generated Visual Prompt:\n---\n" + visualPrompt + "\n---");

  console.log("\n--- Step 3: Generating the image with Cloudflare AI... ---");
  const imageBuffer = await generateWithCloudflare(visualPrompt);

  // Ensure the output directory exists
  const outputDir = "./samples/images";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Use the same timestamp for all related files
  const timestamp = Date.now();
  const imageOutputPath = `${outputDir}/poem_image_${timestamp}.png`;
  const poemOutputPath = `${outputDir}/poem_text_${timestamp}.txt`;
  const poemPromptPath = `${outputDir}/poem_prompt-text_${timestamp}.txt`;
  const imagePromptPath = `${outputDir}/poem_prompt-image_${timestamp}.txt`;

  // Save all files: generated content and their prompts
  fs.writeFileSync(imageOutputPath, imageBuffer);
  fs.writeFileSync(poemOutputPath, poem);
  fs.writeFileSync(poemPromptPath, poemGenerationPrompt);
  fs.writeFileSync(imagePromptPath, visualPrompt);

  console.log(`\n✅ Success! Files saved:
  - Image: ${imageOutputPath}
  - Poem: ${poemOutputPath}
  - Poem Prompt: ${poemPromptPath}
  - Image Prompt: ${imagePromptPath}`);
}

// Run the main workflow
main().catch((error) => {
  console.error("\nWorkflow failed.", error.message);
});
```

### How to Run

The process is the same as before:

1.  **Install Dependencies:** If you haven't already, run `npm install node-fetch`.
2.  **Replace Credentials:** Update the placeholder values for `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` in the script.
3.  **Execute:** In your terminal, run the script:
    ```bash
    node poem-to-image-cloudflare.js
    ```

### Output Files

The script creates a set of related files in the `./samples/images/` directory, all sharing the same timestamp to maintain their relationship:

1. **Generated Content:**

   - `poem_image_[timestamp].png` - The generated image
   - `poem_text_[timestamp].txt` - The generated poem text

2. **Generation Prompts:**
   - `poem_prompt-text_[timestamp].txt` - The prompt used to generate the poem
   - `poem_prompt-image_[timestamp].txt` - The prompt used to generate the image

This structure provides complete traceability from initial prompt through to final output, making it easy to understand and reproduce the generation process.

You will see the same three-step process in your console, but this time the image will be generated by Cloudflare's infrastructure and all files will be saved in the `samples/images` directory.

## Positive aspects / strengths

- Clear separation of concerns: Gemini is used solely for text generation (poem + visual prompt) and Cloudflare is used for image rendering. That keeps responsibilities aligned to each provider's strengths.
- Traceability: the script saves poem, poem prompt, and image prompt alongside the produced image using a shared timestamp — useful for debugging and reproducibility.
- Prototype-friendly: minimal dependencies and straightforward Node.js code make it easy to try different providers or models.
- Correct binary handling: the code reads Cloudflare's response as an ArrayBuffer and converts it to a Node Buffer before writing the PNG file.

## Key risks, mismatches and caveats

- API contract assumptions: the script assumes a particular Gemini JSON shape (`candidates[].content.parts[0].text`) and a specific Cloudflare AI endpoint and model name — verify both against current provider docs.
- Authentication patterns: Gemini endpoints commonly expect Authorization headers rather than a URL `?key=` parameter; ensure correct auth method for your Gemini deployment.
- Content-type assumptions: the code assumes Cloudflare will return raw image bytes on success; a server-side error or HTML response could result in a corrupted file if not validated.
- Runtime compatibility: `node-fetch` usage may cause ESM/CJS issues depending on project module type and Node version; Node >=18 has global fetch which may be preferable.
- No retries/timeouts: transient network issues, rate limits, or long-running requests have no retry/backoff or timeout handling.
- Safety and moderation: generated visual prompts may violate provider policies and be rejected; there's no moderation step.

## Practical suggestions (non-invasive)

- Confirm exact API contracts and authentication methods for both providers before running.
- Use environment variables exclusively and fail fast if required env vars are missing; avoid editing credentials into source files.
- Check `Content-Type` of Cloudflare responses and only write files when the response indicates an image (e.g., `image/png`).
- Prefer built-in `fetch` on Node >=18 or ensure `node-fetch` is installed and compatible with your module system.
- Add timeouts and a retry/backoff policy for both Gemini and Cloudflare calls.
- Add a lightweight safety/moderation check for the generated visual prompt (either provider moderation endpoint or simple filtering) before sending it to the image model.
- Add structured logs and basic metrics (latency, status codes) to help diagnose issues.

## Edge cases to consider

- Gemini returns an empty or filtered response (200 with no usable text) — handle explicitly and avoid proceeding to the image step.
- Cloudflare returns non-image content (error HTML or JSON error body) with a success status — validate `Content-Type` and response length.
- Rate-limit responses or quota exhausted errors from either provider — surface clear messages and consider exponential backoff.
- Import/runtime errors (e.g., ESM vs CJS when importing `node-fetch`) — detect and document required Node version and module type.
- Partial file writes due to process interruption — write to a temp file and rename on success to avoid corrupted artifacts.

## Assessment summary

- The architecture (Gemini for text, Cloudflare for images) is sound for prototyping and provides good traceability.
- The document and script are useful as a developer-facing prototype but need small hardening steps before broader use: auth/response validation, retries/timeouts, safety checks, and secure secret handling.
- For production usage, add observability, strict token scoping, moderation, and tests that mock both Gemini and Cloudflare responses.

## Next steps — two options

Option A — Implement hardening changes (recommended if you want to run reliably):

- Add env-var checks, content-type validation, timeouts, retry/backoff, and a moderation step.
- Verify and adapt authentication to Gemini's recommended pattern (likely Authorization header).
- Replace or configure `node-fetch` to match your Node/module environment or use global fetch.

Option B — Docs-only / manual testing (fast):

- Keep the script as-is for local experimentation after confirming credentials and model names against provider docs.
- Manually inspect saved artifacts and adjust prompts or model selection iteratively.

---

Was the script file reviewed?

Yes — the `poem-to-image-cloudflare.js` script in the document was reviewed as part of this analysis; the review covered response-shape assumptions, fetch usage, binary handling, error handling, and environment/import considerations.
