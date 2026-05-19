import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    proxy: {
      // This maps frontend '/api' to your backend physical path
      "/api": {
        target: "http://localhost",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, "/react-apps/matchabyteri/backend/api"),
      },
    },
  },
});