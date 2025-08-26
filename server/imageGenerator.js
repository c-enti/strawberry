// ESM implementation (converted from CommonJS)
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USE_REAL_AI =
  process.env.USE_REAL_AI === "1" || process.env.USE_REAL_AI === "true";

function safeWriteFileAtomic(destPath, buf) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp-${path.basename(destPath)}-${Date.now()}`);
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, destPath);
}

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function generateWithGemini(payload = {}) {
  // Offline stub: return a deterministic prompt. If USE_REAL_AI, caller must
  // replace this with a real implementation that calls Gemini.
  const text = payload.text || payload.poem || "";
  const prompt = `A soft-focus painterly background that complements: ${
    text.split("\n")[0] || text
  }`;
  return { prompt };
}

async function generateBackgroundForPoem(visualPrompt, opts = {}) {
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">\n` +
    `<rect width="100%" height="100%" fill="#eef"/>\n` +
    `<text x="50" y="320" font-size="36" fill="#445">` +
    `${escapeXml(visualPrompt).slice(0, 120)}` +
    `</text>\n</svg>`;

  const buf = Buffer.from(svg, "utf8");

  let dest = opts.destPath;
  if (!dest) {
    const name = `image-${Date.now()}.svg`;
    dest = path.join(os.tmpdir(), name);
  }

  safeWriteFileAtomic(dest, buf);
  return { imagePath: dest, size: buf.length };
}

async function generatePoemAndImage(poemText, opts = {}) {
  if (!poemText) throw new Error("poemText required");

  let visualPrompt;
  if (USE_REAL_AI) {
    const res = await generateWithGemini({ text: poemText });
    visualPrompt =
      res && res.prompt ? res.prompt : String(poemText).slice(0, 120);
  } else {
    const firstLines = String(poemText).split("\n").slice(0, 2).join(" — ");
    visualPrompt = `soft background, poetic, muted palette. ${firstLines}`;
  }

  const bg = await generateBackgroundForPoem(visualPrompt, opts);

  // Save poem and prompts alongside default outDir if not using opts.destPath
  const defaultOutDir = path.resolve(
    process.cwd(),
    "server",
    "samples",
    "images"
  );
  if (!fs.existsSync(defaultOutDir))
    fs.mkdirSync(defaultOutDir, { recursive: true });

  const timestamp = Date.now();
  const poemOutputPath = path.join(defaultOutDir, `poem_text_${timestamp}.txt`);
  const poemPromptPath = path.join(
    defaultOutDir,
    `poem_prompt-text_${timestamp}.txt`
  );
  const imagePromptPath = path.join(
    defaultOutDir,
    `poem_prompt-image_${timestamp}.txt`
  );

  try {
    fs.writeFileSync(poemOutputPath, poemText);
    fs.writeFileSync(poemPromptPath, poemText);
    fs.writeFileSync(imagePromptPath, visualPrompt);
  } catch (e) {
    // non-fatal
    console.warn("Could not write prompt artifacts:", e.message || e);
  }

  return {
    visualPrompt,
    imagePath: bg.imagePath,
    size: bg.size,
    poemPath: poemOutputPath,
    poemPromptPath,
    imagePromptPath,
  };
}

// Verifier: attempts vision API if configured, otherwise falls back to heuristic
function keywordOverlapScore(a, b) {
  if (!a || !b) return 0;
  const normalize = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const as = normalize(a);
  const bs = normalize(b);
  if (as.length === 0 || bs.length === 0) return 0;
  const setB = new Set(bs);
  let common = 0;
  for (const w of as) if (setB.has(w)) common++;
  return common / Math.max(as.length, bs.length);
}

async function verifyImageMatchesText(imagePath, textPrompt) {
  // Read image
  let buf;
  try {
    if (path.isAbsolute(imagePath) && fs.existsSync(imagePath)) {
      buf = fs.readFileSync(imagePath);
    } else if (fs.existsSync(imagePath)) {
      buf = fs.readFileSync(imagePath);
    } else if (fs.existsSync(path.resolve(process.cwd(), imagePath))) {
      buf = fs.readFileSync(path.resolve(process.cwd(), imagePath));
    } else if (fs.existsSync(path.resolve(__dirname, imagePath))) {
      buf = fs.readFileSync(path.resolve(__dirname, imagePath));
    } else {
      throw new Error("image not found");
    }
  } catch (e) {
    return {
      match: false,
      score: 0,
      details: `Could not read image: ${e.message}`,
    };
  }

  const b64 = buf.toString("base64");

  // If Gemini configured, attempt a vision request (best-effort, non-fatal)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_URL) {
    const rawKey = String(process.env.GEMINI_API_KEY || "");
    let requestUrl = process.env.GEMINI_API_URL;
    const headers = { "Content-Type": "application/json" };
    if (/^AIza[0-9A-Za-z-_]+$/.test(rawKey)) {
      headers["X-goog-api-key"] = rawKey;
    } else if (/^ya29\./.test(rawKey)) {
      headers.Authorization = `Bearer ${rawKey}`;
    } else {
      const sep = requestUrl.includes("?") ? "&" : "?";
      requestUrl = requestUrl + sep + "key=" + encodeURIComponent(rawKey);
    }

    const payload = {
      instances: [
        {
          input: {
            image: { content: b64 },
            text: `Does this image depict: ${textPrompt}? Answer concisely.`,
          },
        },
      ],
    };

    try {
      let fetchImpl = globalThis.fetch;
      if (!fetchImpl) {
        try {
          // dynamic import of undici in ESM
          fetchImpl = (await import("undici")).fetch;
        } catch (e) {
          // node-fetch default export
          fetchImpl = (await import("node-fetch")).default;
        }
      }
      const resp = await fetchImpl(requestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const txt = await resp.text();
      if (!resp.ok) {
        console.warn(
          "verifyImageMatchesText: vision request returned error:",
          resp.status,
          txt.slice(0, 400)
        );
      } else {
        try {
          const j = JSON.parse(txt);
          function extractTextFromResp(o) {
            if (!o) return null;
            if (typeof o === "string") return o;
            if (Array.isArray(o))
              return o.map(extractTextFromResp).filter(Boolean).join("\n");
            if (typeof o === "object") {
              for (const k of [
                "candidates",
                "outputs",
                "result",
                "predictions",
                "responses",
              ])
                if (k in o) return extractTextFromResp(o[k]);
              const parts = [];
              for (const v of Object.values(o)) {
                const t = extractTextFromResp(v);
                if (t) parts.push(t);
              }
              return parts.join("\n");
            }
            return null;
          }
          const respText = extractTextFromResp(j) || "";
          const lower = respText.toLowerCase();
          if (/\bno\b/.test(lower) || /\bdoes not\b/.test(lower))
            return {
              match: false,
              score: 0.2,
              details: `Vision model indicates mismatch: ${respText.slice(
                0,
                400
              )}`,
            };
          if (
            /\byes\b/.test(lower) ||
            /\bdepict\b|\bshows\b|\bcontains\b/.test(lower)
          )
            return {
              match: true,
              score: 0.9,
              details: `Vision model positive: ${respText.slice(0, 400)}`,
            };
          const score = keywordOverlapScore(textPrompt, respText);
          return {
            match: score > 0.25,
            score,
            details: `Vision response: ${respText.slice(0, 400)}`,
          };
        } catch (e) {
          const lower = txt.toLowerCase();
          if (/\byes\b/.test(lower) || /\bdepict\b|\bshows\b/.test(lower))
            return {
              match: true,
              score: 0.8,
              details: `Vision text: ${txt.slice(0, 400)}`,
            };
          const score = keywordOverlapScore(textPrompt, txt);
          return {
            match: score > 0.25,
            score,
            details: `Vision text (raw): ${txt.slice(0, 400)}`,
          };
        }
      }
    } catch (e) {
      console.warn(
        "verifyImageMatchesText: error calling vision API:",
        e && e.message ? e.message : e
      );
    }
  }

  // Fallback heuristic
  const score = keywordOverlapScore(textPrompt, "");
  return {
    match: score > 0.25,
    score,
    details: "No vision API available; heuristic fallback used",
  };
}

export {
  generateWithGemini,
  generateBackgroundForPoem,
  generatePoemAndImage,
  verifyImageMatchesText,
};
