import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  // GitHub Pages serves a project site from /<repo>/, so assets need that prefix.
  // Local dev and any root-hosted deploy keep "/" — set BASE_PATH in CI only.
  base: process.env.BASE_PATH ?? "/",
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
}));
