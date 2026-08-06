/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Geist / Linear monochrome dark — scarce semantic color only
        canvas: "#000000",
        panel: "#0a0a0a",
        elevated: "#111111",
        line: "#1a1a1a",
        line2: "#262626",
        ink: "#ededed",
        mute: "#888888",
        faint: "#666666",
        good: "#3ecf8e",
        warn: "#f5a623",
        bad: "#ff5c5c",
        accent: "#0070f3",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
      },
      spacing: {
        // Snap common gaps to 4px grid (Tailwind already multiples of 4)
      },
    },
  },
  plugins: [],
};
