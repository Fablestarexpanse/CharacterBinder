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
          "purple-light": "#a78bfa",
          green: "#22c55e",
          "green-dim": "#166534",
        },
        border: {
          DEFAULT: "#D2D2D7",
          light: "#E5E5EA",
        },
        text: {
          primary: "#1D1D1F",
          secondary: "#6E6E73",
          muted: "#86868B",
          purple: "#7c3aed",
          green: "#1a7f3c",
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
