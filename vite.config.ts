import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Set VITE_BASE=/your-repo-name/ for GitHub project pages, or / for custom domain root.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  plugins: [react()],
  base,
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
