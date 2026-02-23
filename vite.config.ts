import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const isReplit = process.env.REPL_ID !== undefined;

export default defineConfig({
  plugins: [
    react(),
    ...(isReplit ? [runtimeErrorOverlay()] : []),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    isReplit
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/wouter/") ||
            id.includes("/@tanstack/")
          ) {
            return "react-core";
          }

          if (
            id.includes("/framer-motion/") ||
            id.includes("/@radix-ui/") ||
            id.includes("/class-variance-authority/") ||
            id.includes("/tailwind-merge/") ||
            id.includes("/clsx/")
          ) {
            return "motion-ui";
          }

          if (id.includes("/recharts/")) {
            return "charts";
          }

          if (id.includes("/lucide-react/") || id.includes("/react-icons/")) {
            return "icons";
          }

          return undefined;
        },
      },
    },
  },
});
