/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  // Single source of truth for the version shown in the UI. Without this the
  // sidebar and Help/About carried hardcoded strings that drifted behind
  // package.json on every release.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 3737,
    strictPort: true,
  },
  // Components and hooks need a DOM to run in. Without this block they were not
  // merely untested but untestable, so every regression in them had to be found
  // by hand in a browser.
  test: {
    environment: "jsdom",
    // mcp/ is its own package with its own suite (npm --prefix mcp test); running
    // it from here too would bind the bridge port twice.
    exclude: ["node_modules/**", "dist/**", "mcp/**"],
    setupFiles: ["./src/test/setup.ts"],
    // Node for anything that has no DOM in it, so the pure modules keep running
    // at their current speed.
    environmentMatchGlobs: [
      ["src/lib/**", "node"],
      ["src/shared/**", "node"],
    ],
  },
}));
