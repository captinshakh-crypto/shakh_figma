import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shakh: { orange: "#F47721", blue: "#1769AA", ink: "#142B3B", mist: "#F4F8FB" }
      },
      boxShadow: { soft: "0 14px 40px rgba(20,43,59,.08)" }
    }
  },
  plugins: []
};
export default config;