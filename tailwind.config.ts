import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crystal: {
          50:  "#eef6ff",
          100: "#d9eaff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#0b1d3a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
