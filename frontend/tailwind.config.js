/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-dark": "#0f172a",
        "brand-gold": "#f59e0b",
        "brand-light": "#f8fafc",
        "brand-blue": "#2563eb",
        "brand-blue-light": "#eff6ff",
        ink: "#18362f",
        forest: "#20483e",
        leaf: "#cce77a",
        paper: "#f3f6f2",
        line: "#e3e9e4",
        muted: "#718078",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Manrope", "sans-serif"],
      },
    },
  },
  plugins: [],
}

