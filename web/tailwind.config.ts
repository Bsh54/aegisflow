import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deep: "#020203",
        base: "#0a0a0f",
        elevated: "#0a0a0c",
        surface: "rgba(255,255,255,0.05)",
        edge: "rgba(255,255,255,0.08)",
        fg: "#EDEDEF",
        mutedfg: "#8A8F98",
        flare: "#E0245E",
        gold: "#F59E0B",
        clear: "#2DD4A7",
        review: "#F5A623",
        blocked: "#FF4D5E",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
} satisfies Config;
