/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#F5F5F7",
          secondary: "#FFFFFF",
          tertiary: "#F2F2F2",
          card: "#FFFFFF",
          hover: "#E8E8ED",
        },
        accent: {
          purple: "#7c3aed",
          "purple-hover": "#6d28d9",
          "purple-light": "#6d28d9",
          green: "#15803D",
        },
        // Semantic status colours. Every foreground here clears WCAG AA (4.5:1)
        // against both the page background (#F5F5F7) and card white, and against
        // its own `-soft` surface. Use these instead of raw Tailwind palette
        // classes — the app is a light theme and `text-red-400` &co. are not legible.
        status: {
          danger: "#B42318",
          "danger-soft": "#FDECEA",
          "danger-border": "#F3B9B4",
          warn: "#92400E",
          "warn-soft": "#FFF7E6",
          "warn-border": "#F0D9A8",
          ok: "#15803D",
          "ok-soft": "#E9F7EF",
          "ok-border": "#A9DCBD",
          info: "#1D4ED8",
          "info-soft": "#E8EEFD",
        },
        // The script editor is a dark code surface inside a light app — the one
        // place that deliberately inverts. Its colours live here rather than as
        // inline hex in the component, so they are named and can be adjusted in
        // one place like every other colour.
        code: {
          bg: "#1a1d2e",
          gutter: "#3d4a6b",
          text: "#c8d3f5",
          chrome: "#7a8aaa",
          accent: "#a78bfa",
          border: "rgba(100,110,160,0.2)",
          "border-soft": "rgba(100,110,160,0.15)",
          "border-faint": "rgba(100,110,160,0.12)",
        },
        border: {
          DEFAULT: "#D2D2D7",
          light: "#E5E5EA",
        },
        text: {
          primary: "#1D1D1F",
          secondary: "#55555A",
          muted: "#6E6E73",
          purple: "#7c3aed",
          green: "#15803D",
        },
      },
      // No web fonts are loaded (see index.html). Inter and JetBrains Mono are
      // used when the user happens to have them installed; the rest of each
      // stack is what the OS already ships, so the app looks native offline.
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Cascadia Code",
          "SF Mono",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
