import sharp from "sharp";

/**
 * Validate an image buffer or file path.
 * Returns: { ok: boolean, width?: number, height?: number, format?: string, error?: string }
 */
export async function validateImage(input) {
  try {
    let img;
    if (Buffer.isBuffer(input)) {
      img = sharp(input);
    } else if (typeof input === "string") {
      img = sharp(input);
    } else {
      throw new Error("Unsupported input type");
    }

    const meta = await img.metadata();
    const { width, height, format } = meta || {};

    if (!width || !height) {
      return { ok: false, error: "Unable to determine image dimensions" };
    }

    return { ok: true, width, height, format };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

export default validateImage;
