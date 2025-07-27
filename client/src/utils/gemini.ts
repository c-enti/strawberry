// Google Gemini API connection utility for ChronosCraft AI
// This is a scaffold for authentication and basic request handling

import axios from "axios";

export interface GeminiImageRequest {
  prompt: string;
  width?: number;
  height?: number;
}

export interface GeminiImageResponse {
  imageUrl: string;
  meta?: unknown;
}

const GEMINI_API_URL =
  process.env.NEXT_PUBLIC_GEMINI_API_URL || process.env.GEMINI_API_URL || "";
const GEMINI_API_KEY =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function requestGeminiImage(
  req: GeminiImageRequest
): Promise<GeminiImageResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API URL or key not set in environment variables");
  }
  if (!GEMINI_API_URL) {
    throw new Error("Gemini API URL or key not set in environment variables");
  }
  // Example payload structure; adjust for actual Gemini API
  const payload = {
    prompt: req.prompt,
    width: req.width || 1024,
    height: req.height || 768,
  };
  try {
    const response = await axios.post(GEMINI_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    // Adjust response parsing for actual Gemini API
    return {
      imageUrl: response.data.imageUrl || "",
      meta: response.data.meta || {},
    };
  } catch (error: unknown) {
    // Log error for debugging
    console.error("Gemini API error:", error);
    if (error instanceof Error) {
      throw error; // Preserve original error
    }
    throw new Error("Gemini API URL or key not set in environment variables");
  }
}
