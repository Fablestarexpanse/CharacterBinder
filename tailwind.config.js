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
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
