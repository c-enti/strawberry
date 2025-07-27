// Gemini image generation pipeline for ChronosCraft AI
// This function wraps requestGeminiImage and handles pipeline steps

import {
  requestGeminiImage,
  GeminiImageRequest,
  GeminiImageResponse,
} from "./gemini";

export interface ImagePipelineOptions extends GeminiImageRequest {
  optimize?: boolean;
  format?: "png" | "jpeg" | "webp";
}

export interface ImagePipelineResult extends GeminiImageResponse {
  optimizedUrl?: string;
  format?: string;
}

/**
 * Runs the image generation pipeline using Gemini API and optional optimization.
 * @param options ImagePipelineOptions
 * @returns ImagePipelineResult
 */
export async function runImageGenerationPipeline(
  options: ImagePipelineOptions
): Promise<ImagePipelineResult> {
  try {
    // Step 1: Generate image from Gemini
    const imageResult = await requestGeminiImage(options);

    // Step 2: Optionally optimize image (mock implementation)
    let optimizedUrl = imageResult.imageUrl;
    const format = options.format || "png";

    if (options.optimize) {
      // Here you would add real optimization logic (compression, format conversion, etc.)
      // For now, just append a query param to simulate optimization
      optimizedUrl = `${imageResult.imageUrl}?optimized=true&format=${format}`;
    }

    return {
      ...imageResult,
      optimizedUrl,
      format,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error; // Re-throw original error to preserve message
    }
    throw new Error("Pipeline error");
  }
}
