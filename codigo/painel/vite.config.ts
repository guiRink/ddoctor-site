/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// O painel é publicado dentro do mesmo GitHub Pages da landing, em /painel/.
export default defineConfig({
  base: "/ddoctor-site/painel/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../site/painel",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
