import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, Vite serves the UI on :5174 and forwards /api calls to the server on :4318.
export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://localhost:4318" },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
