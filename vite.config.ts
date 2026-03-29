import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    legacy({
      targets: ["defaults", "not IE 11", "ios >= 12", "safari >= 12", "chrome >= 64"],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  build: {
    target: "es2015",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
