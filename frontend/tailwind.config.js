/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Vercel-grade monochrome dark (calm product surface)
        canvas: "#000000",
        panel: "#0a0a0a",
        elevated: "#111111",
        line: "#1a1a1a",
        line2: "#262626",
        ink: "#ededed",
        mute: "#888888",
        faint: "#666666",
        // semantic: scarce color
        good: "#00c853",
        warn: "#f5a623",
        bad: "#ff4d4f",
        accent: "#0070f3",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
      },
    },
  },
  plugins: [],
};
