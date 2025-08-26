Of course. Here is a complete, runnable code sample that implements the "Orchestrator" workflow we discussed.

### Clarification on Model Roles

First, a quick and important clarification on the models. The quote from our previous conversation mentioned `gemini-pro-vision`.

- **`gemini-pro-vision`** is for when you want the AI to _look at and understand an image_ you provide.
- **`gemini-1.5-pro-latest`** is for when you want the AI to _understand and process text_ (like a poem).

For your goal of creating an image _from_ a poem, you need the text model (`gemini-1.5-pro-latest`) to perform the creative "thinking" and translation steps. The code below uses the correct model for the job.

---

### The Three-Step Workflow Implemented

This code will perform the following actions:

1.  **Step 1:** Call the Gemini API to generate a poem based on a theme.
2.  **Step 2:** Call the Gemini API a second time, feeding it the poem to create a detailed, visual prompt for an image generator.
3.  **Step 3:** Call a third-party image generation API (in this case, Stability AI's Stable Diffusion) with that visual prompt to create and save the final image.

### Prerequisites

1.  **Node.js:** Make sure you have Node.js installed on your machine.
2.  **API Keys:**
    - **Gemini API Key:** Get it from [Google AI Studio](https://aistudio.google.com/app/apikey).
    - **Stability AI API Key:** Sign up for a free account at [Stability AI / DreamStudio](https://platform.stability.ai/) and find your API key in the account settings. Their API offers a free tier of credits to start.
3.  **Dependencies:** You'll need `node-fetch` to make the web requests. Install it by running this in your terminal:
    ```bash
    npm install node-fetch
    ```

---

### Sample Code: `poem-to-image-stability.js`

Save the following code as a file named `poem-to-image-stability.js`. The code includes TypeScript-style type definitions for better error handling and type safety, along with comprehensive file output management.

```javascript
// poem-to-image-stability.js

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

/** @typedef {Object} StabilityArtifact {
 *   base64: string,
 *   seed: number,
 *   finishReason: string
 * } */

/** @typedef {Object} StabilityResponse {
 *   artifacts: StabilityArtifact[]
 * } */

// --- CONFIGURATION: Replace with your actual API keys ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
const GEMINI_API_URL = process.env.GEMINI_API_URL || "YOUR_GEMINI_API_URL";
const STABILITY_API_KEY =
  process.env.STABILITY_API_KEY || "YOUR_STABILITY_AI_KEY";
// ---------------------------------------------------------

const STABILITY_API_URL =
  "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image";

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
      console.error(
        "Unexpected response structure from Gemini API:",
        JSON.stringify(data, null, 2)
      );
      throw new Error("Could not extract text from Gemini API response.");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

/**
 * Calls the Stability AI API to generate an image.
 * @param {string} prompt - The visual prompt for the image.
 * @returns {Promise<Buffer>} A buffer containing the generated PNG image data.
 */
async function generateWithStability(prompt) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${STABILITY_API_KEY}`,
  };
  const body = JSON.stringify({
    text_prompts: [{ text: prompt }],
    cfg_scale: 7,
    height: 1024,
    width: 1024,
    samples: 1,
    steps: 30,
  });

  try {
    const response = await fetch(STABILITY_API_URL, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stability API Error: ${response.status} ${errorText}`);
    }

    /** @type {StabilityResponse} */
    const data = await response.json();

    // Type-safe access with runtime validation
    if (
      !data ||
      !Array.isArray(data.artifacts) ||
      data.artifacts.length === 0
    ) {
      throw new Error(
        "Invalid API response structure: missing artifacts array"
      );
    }

    const imageBase64 = data.artifacts[0]?.base64;
    if (!imageBase64) {
      throw new Error("No image data in the response");
    }

    return Buffer.from(imageBase64, "base64");
  } catch (error) {
    console.error("Error calling Stability AI API:", error);
    throw error;
  }
}

/**
 * Main function to run the full poem-to-image workflow.
 */
async function main() {
  console.log("--- Step 1: Generating a poem... ---");
  const poemTheme =
    "a forgotten library where books whisper secrets to the moonlight.";
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

  console.log("\n--- Step 3: Generating the image with Stability AI... ---");
  const imageBuffer = await generateWithStability(visualPrompt);

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

### Output Files

The script creates a set of related files in the `./samples/images/` directory, all sharing the same timestamp to maintain their relationship:

1. **Generated Content:**

   - `poem_image_[timestamp].png` - The generated image
   - `poem_text_[timestamp].txt` - The generated poem text

2. **Generation Prompts:**
   - `poem_prompt-text_[timestamp].txt` - The prompt used to generate the poem
   - `poem_prompt-image_[timestamp].txt` - The prompt used to generate the image

This structure provides complete traceability from initial prompt through to final output, making it easy to understand and reproduce the generation process.

### How to Run the Code

1.  **Replace API Keys:** Open `poem-to-image-stability.js` and replace `"YOUR_GEMINI_API_KEY"` and `"YOUR_STABILITY_AI_KEY"` with your actual keys. (It's better practice to use environment variables as shown, but direct replacement works for a quick prototype).

2.  **Open Your Terminal:** Navigate to the directory where you saved the file.

3.  **Run the Script:**
    ```bash
    node poem-to-image-stability.js
    ```

You will see the output in your terminal for each step of the process. The script will create the `samples/images` directory if it doesn't exist, and save all generated files there with matching timestamps for easy reference.
