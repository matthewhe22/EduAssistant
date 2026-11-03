import type { Config } from "tailwindcss";

/** EduAssistant design tokens (see the "EduAssistant redesign" canvas). */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#17202A", soft: "#3D4852", muted: "#55606B" },
        paper: "#FBFBF8",
        line: { DEFAULT: "#E2E4DE", strong: "#C9CDC4" },
        mist: "#F4F6F2",
        euc: { DEFAULT: "#1E5A43", dark: "#123B2B", tint: "#E6F0EA" },
        wattle: { DEFAULT: "#F2B53A", tint: "#FDF1D8", ink: "#5C3D00" },
        sky: { tint: "#E7EEF6", ink: "#1F3A5C" },
        plum: { tint: "#F1E9F3", ink: "#4A2A52" },
        alert: { DEFAULT: "#A33A2B", tint: "#FBECE9" },
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', "system-ui", "sans-serif"],
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
