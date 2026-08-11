import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "hostinger-web",
  publicDir: "../public",
  base: "/",
  plugins: [react()],
  css: {
    postcss: "../postcss.config.mjs",
  },
  build: {
    outDir: "../hostinger-package",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
  },
});
