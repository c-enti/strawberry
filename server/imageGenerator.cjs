// CommonJS wrapper for the ESM imageGenerator implementation.
// This keeps existing `require('./imageGenerator')` callers working while
// the canonical implementation lives in `imageGenerator.js` (ESM).

const { createRequire } = require("module");
// In a CommonJS runtime `import.meta` is not available. Use __filename
// to create a require function that resolves relative to this file.
const requireFrom = createRequire(__filename);

let _impl = null;
async function load() {
  if (_impl) return _impl;
  // Prefer explicit ESM file if present
  try {
    _impl = await import("./imageGenerator.js");
  } catch (e) {
    // Fallback: try .mjs
    _impl = await import("./imageGenerator.mjs");
  }
  return _impl;
}

module.exports = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === "then") return undefined; // allow require() to treat as sync
      return (...args) =>
        load().then((impl) => {
          const fn = impl[prop];
          if (!fn)
            throw new Error(
              `export ${String(prop)} not found on imageGenerator`
            );
          return fn(...args);
        });
    },
  }
);
