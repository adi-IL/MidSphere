/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "#0f172a",
        panel: "#1e293b",
        elevated: "#334155",
        primary: "#f8fafc",
        muted: "#94a3b8",
        dim: "#64748b",
        healthy: "#34d399",
        warn: "#fbbf24",
        broken: "#f43f5e",
        brand: "#1890ff",
        pulse: "#38bdf8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 0 0 1px #334155, 0 12px 40px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
