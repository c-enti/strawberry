// Gemini theme suggestion system for ChronosCraft AI
// This utility requests theme suggestions from Gemini API

import axios from "axios";

export interface ThemeSuggestionRequest {
  prompt: string;
  style?: string;
}

export interface ThemeSuggestion {
  palette: string[];
  fonts: string[];
  description: string;
}

export interface ThemeSuggestionResponse {
  suggestions: ThemeSuggestion[];
  meta?: unknown;
}

const GEMINI_THEME_API_URL =
  process.env.NEXT_PUBLIC_GEMINI_THEME_API_URL ||
  process.env.GEMINI_THEME_API_URL ||
  process.env.NEXT_PUBLIC_GEMINI_API_URL ||
  process.env.GEMINI_API_URL ||
  "";
const GEMINI_API_KEY =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function requestThemeSuggestions(
  req: ThemeSuggestionRequest
): Promise<ThemeSuggestionResponse> {
  // First check for credentials
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini Theme API URL or key not set in environment variables"
    );
  }
  if (!GEMINI_THEME_API_URL) {
    throw new Error(
      "Gemini Theme API URL or key not set in environment variables"
    );
  }
  // Example payload structure; adjust for actual Gemini API
  const payload = {
    prompt: req.prompt,
    style: req.style || "modern",
  };
  try {
    const response = await axios.post(GEMINI_THEME_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    // Adjust response parsing for actual Gemini API
    return {
      suggestions: response.data.suggestions || [],
      meta: response.data.meta || {},
    };
  } catch (error: unknown) {
    console.error("Gemini Theme API error:", error);
    if (error instanceof Error) {
      throw error; // Preserve original error
    }
    throw new Error(
      "Gemini Theme API URL or key not set in environment variables"
    );
  }
}
