import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  appType: "spa",
  resolve: {
    // Prefer TS sources over accidental sibling .js emit files.
    extensions: [".tsx", ".ts", ".jsx", ".mjs", ".js", ".json"],
  },
});
