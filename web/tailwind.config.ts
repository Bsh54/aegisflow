import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0f1e",       // deep navy background
        panel: "#111830",     // card background
        edge: "#1e2a4a",      // borders
        flare: "#e0245e",     // Flare pink accent
        clear: "#2dd4a7",
        review: "#f5a623",
        blocked: "#ff4d5e",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
