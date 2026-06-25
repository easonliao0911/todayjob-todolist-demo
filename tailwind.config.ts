import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        paper: "#f6f7f9",
        line: "#d8dde6",
        steel: "#667085",
      },
      boxShadow: {
        panel: "0 10px 28px rgba(16, 24, 40, 0.08)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Noto Sans TC",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
