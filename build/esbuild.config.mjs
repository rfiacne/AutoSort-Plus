import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");
const src = resolve(root, "src");

const watch = process.argv.includes("--watch");

// Clean dist (with retry for Windows file locking)
if (existsSync(dist)) {
  try { rmSync(dist, { recursive: true, maxRetries: 5, retryDelay: 200 }); } catch { /* fall through */ }
}
mkdirSync(dist, { recursive: true });
mkdirSync(resolve(dist, "js/workers"), { recursive: true });

async function build() {
  // ── Standalone shared modules (for options page) + content script ──
  await esbuild.build({
    entryPoints: [
      resolve(src, "shared/logger.ts"),
      resolve(src, "shared/i18n.ts"),
      resolve(src, "content.ts"),
      resolve(src, "ollama.ts"),
      resolve(src, "workers/ollama-worker.ts"),
    ],
    bundle: true,
    format: "iife",
    target: "es2020",
    platform: "browser",
    outdir: resolve(dist, "js"),
    entryNames: "[name]",
    logLevel: "info",
    absWorkingDir: root,
    external: ["browser", "messenger"],
  });
  console.log("  → dist/js/ollama.js");
  console.log("  → dist/js/logger.js");
  console.log("  → dist/js/i18n.js");
  console.log("  → dist/js/content.js");
  console.log("  → dist/js/ollama-worker.js");

  // Copy content script to dist root (manifest expects it there)
  cpSync(resolve(dist, "js/content.js"), resolve(dist, "content.js"));
  console.log("  → dist/content.js (from TS)");

  // Copy worker to dist/js/workers/
  cpSync(
    resolve(dist, "js/ollama-worker.js"),
    resolve(dist, "js/workers/ollama-worker.js")
  );
  console.log("  → dist/js/workers/ollama-worker.js (from TS)");

  // ── Background script ──────────────────────────
  // Single TypeScript entry — no more JS concatenation
  await esbuild.build({
    entryPoints: [resolve(src, "background/index.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    platform: "browser",
    outfile: resolve(dist, "background.js"),
    logLevel: "info",
    absWorkingDir: root,
    external: ["browser", "messenger"],
  });
  console.log("  → dist/background.js (from TS)");

  // ── Options page: compile TypeScript with esbuild ──
  await esbuild.build({
    entryPoints: [resolve(src, "options/app.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    platform: "browser",
    outfile: resolve(dist, "options.js"),
    logLevel: "info",
    absWorkingDir: root,
    external: ["browser", "messenger"],
  });
  console.log("  → dist/options.js (from TS)");

  // ── Copy static files ──────────────────────────

  cpSync(resolve(root, "options.html"), resolve(dist, "options.html"));
  console.log("  → dist/options.html");

  cpSync(resolve(root, "styles.css"), resolve(dist, "styles.css"));
  console.log("  → dist/styles.css");

  for (const dir of ["icons", "_locales", "api_ollama"]) {
    cpSync(resolve(root, dir), resolve(dist, dir), { recursive: true });
    console.log(`  → dist/${dir}/`);
  }

  // ── Ollama popup (web_accessible_resource) ──
  await esbuild.build({
    entryPoints: [resolve(src, "popup/ollama-popup.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    platform: "browser",
    outfile: resolve(dist, "api_ollama/ollama-popup.js"),
    logLevel: "info",
    absWorkingDir: root,
    external: ["browser", "messenger"],
  });
  console.log("  → dist/api_ollama/ollama-popup.js (from TS)");

  // ── Generate dist manifest ─────────────────────
  const manifest = JSON.parse(
    readFileSync(resolve(root, "manifest.json"), "utf-8")
  );
  manifest.background = { scripts: ["background.js"] };
  writeFileSync(
    resolve(dist, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8"
  );
  console.log("  → dist/manifest.json");

  console.log("\n✅ Build complete. Load dist/ as temporary extension in Thunderbird.");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
