import { generatePoemAndImage } from "./imageGenerator.js";
import os from "os";
import path from "path";

async function run() {
  const poem = `Rivers hum beneath the moonlit sky,\nPetals fall like whispered why.`;
  const dest = path.join(os.tmpdir(), `smoke-image-${Date.now()}.bin`);

  try {
    const res = await generatePoemAndImage(poem, { destPath: dest });
    console.log("visualPrompt:", res.visualPrompt);
    console.log("imagePath:", res.imagePath);
    console.log("size:", res.size);
    process.exit(0);
  } catch (err) {
    console.error("ERROR", err && err.stack ? err.stack : err);
    process.exit(2);
  }
}

run();
