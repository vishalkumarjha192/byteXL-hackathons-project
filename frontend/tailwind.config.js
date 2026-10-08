/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#15171E", mist: "#F4F5F8", line: "#E3E5EC", muted: "#5F6475", brand: { DEFAULT: "#3B3BF2", dark: "#2A2AC4", soft: "#ECECFE" } },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
