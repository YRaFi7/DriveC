import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kinto: {
          blue: "#002C6C",      // Signature KINTO Deep Navy
          accent: "#009BDE",    // Signature KINTO Cyan / Electric Blue
          teal: "#00B2A9",      // Secondary Eco/Mobility Teal
          light: "#F4F7FA",     // Premium light background
          dark: "#0F172A",      // Dark backdrop
          slate: "#334155",
          silver: "#E2E8F0",
          gold: "#D97706",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['Inter Tight', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
