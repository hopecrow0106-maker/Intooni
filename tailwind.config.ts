import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        /* admin 호환 */
        ink:   "#1a1a1a",
        coral: "#ff4d6d",
        mist:  "#f8f7f4",
        /* 디자인 토큰 */
        accent:        "#ff4d6d",
        "accent-soft": "#fff0f3",
        "accent-text": "#c9153d",
        surface:       "#ffffff",
        "surface-2":   "#f2f0ec",
        tag:           "#edecff",
        "tag-text":    "#3d35b0",
        "t-main":      "#1a1a1a",
        "t-sub":       "#6b6b6b",
        "t-muted":     "#a0a0a0"
      },
      fontFamily: {
        moyamoya: ["Cafe24Moyamoya", "sans-serif"]
      },
      animation: {
        "fade-up":    "fadeUp 0.5s ease forwards",
        "pulse-soft": "pulseSoft 1.5s ease-in-out infinite"
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.5" },
          "50%":      { opacity: "1" }
        }
      }
    }
  },
  plugins: []
};

export default config;
