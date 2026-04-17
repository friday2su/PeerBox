import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0a0a0f",
        panel: "#13131a",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        panel: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "pulse-soft": "pulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
