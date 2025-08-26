Poem→Image API and CLI

This document describes the orchestrator and the run-time wiring used in the repository:

- Gemini (text) — used to generate poems and to convert poems into detailed image prompts.
- Cloudflare Workers AI — used to produce the actual image bytes from the visual prompt.
- Gemini (vision) — used to assess image fidelity by submitting the generated image inline (Base64) along with a verification prompt.

Endpoints

POST /api/generate/poem-image

- Body: { theme?: string, format?: 'png'|'svg' }
- Returns: { success: true, result: { image, poem, poemPrompt, imagePrompt, verification } }
- Notes: The endpoint lazily loads the orchestrator and returns the saved artifact paths (relative to repository root). When image provider credentials are not present the orchestrator falls back to creating an offline SVG/PNG stub so artifact generation is deterministic for demos.

Background export job integration

POST /api/export/job

- Add generateImages: true to the job payload to have the background export job call the orchestrator for each poem and attach generated images as `background`.
- Example payload: { poems: [...], generateImages: true }

CLI

server/scripts/run_generate_poem_image.js

- Runs the orchestrator locally and prints the result.
- Usage: node server/scripts/run_generate_poem_image.js

Files / artifact locations

- Artifacts are saved under `server/samples/images/` with matching timestamps:
  - poem*text*{ts}.txt
  - poem*prompt-text*{ts}.txt
  - poem*prompt-image*{ts}.txt
  - poem*image*{ts}.png (or .svg)
  - verification\_{ts}.json

Runtime wiring (what to set)

- GEMINI_API_URL / GEMINI_API_KEY — used for text generation (poem + visual prompt).
- CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN — used by the Cloudflare Workers AI image generation script to produce PNG bytes.
- GEMINI_VISION_API_URL / GEMINI_API_KEY — used to POST the generated image inline (Base64) along with a verification prompt to assess fidelity.

Verifying images with Gemini Vision (Base64 inline)

The verifier expects the generated image bytes to be embedded in the JSON request body as base64 (no filename). Below is a copy-pasteable terminal example that encodes an image and submits it to the Gemini vision endpoint. Replace YOUR_API_KEY and the endpoint URL with your values.

```bash
# --- Example: encode an image and call Gemini Vision (gemini-1.0-pro-vision) ---
API_KEY="YOUR_API_KEY"
IMAGE_FILE="poem_image_1756153172587.png"

# Linux: prevent line wrapping (macOS base64 differs)
IMG_BASE64=$(base64 -w 0 "$IMAGE_FILE")

JSON_PAYLOAD=$(printf '{
	"contents": [{
		"parts": [
			{"text": "Does this image depict the prompt: <insert original prompt here>? Answer concisely and explain."},
			{"inline_data": { "mime_type": "image/png", "data": "%s" }}
		]
	}]
}' "$IMG_BASE64")

curl -H "Content-Type: application/json" \
	-d "$JSON_PAYLOAD" \
	-X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro-vision:generateContent?key=${API_KEY}"
```

Important notes:

- Ensure `mime_type` matches the image file type (image/png or image/jpeg).
- Do not include newlines in the base64 string (use `-w 0` on Linux). If you are on macOS omit `-w 0`.
- The verifier code in `server/imageGenerator.js` already attempts to perform this step when `GEMINI_API_KEY` and `GEMINI_API_URL` are configured; if the API returns an unexpected payload shape the code will log the error and fall back to a heuristic.

What to do to get real images working

1. Add Cloudflare credentials (CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN) to your environment.
2. Ensure GEMINI_API_URL and GEMINI_API_KEY are set for text and vision calls.
3. Run the CLI: `node server/scripts/run_generate_poem_image.js` — if providers are configured the script will save real PNG bytes; otherwise it will save an SVG/PNG stub.
