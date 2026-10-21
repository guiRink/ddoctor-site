/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// O painel é publicado dentro do mesmo GitHub Pages da landing, em /painel/.
export default defineConfig({
  base: "/ddoctor-site/painel/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@compartilhado": fileURLToPath(new URL("../compartilhado/src", import.meta.url)) },
  },
  server: { fs: { allow: [".."] } },
  build: {
    outDir: "../site/painel",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // os testes usam sempre a demonstração (o .env.local pode apontar para o banco)
    env: { VITE_DADOS: "memoria" },
    include: ["src/**/*.test.{ts,tsx}", "../compartilhado/src/**/*.test.ts"],
  },
});
