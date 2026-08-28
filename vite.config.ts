import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { sites } from "./build/sites-vite-plugin.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    sites(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Baby Tracker — Calm, private baby logging",
        short_name: "Baby Tracker",
        description: "Private, one-handed tracking for feeds, diapers, burping and growth.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fdf5f2",
        theme_color: "#fdf5f2",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        importScripts: ["/notification-sw.js"],
        navigateFallback: "/index.html",
        // Without this the service worker answers EVERY navigation with the
        // cached app shell — including /admin and /api, which live in the
        // Worker and must reach the network.
        navigateFallbackDenylist: [/^\/admin/, /^\/api\//],
        globPatterns: ["**/*.{html,js,css,png,svg,webmanifest}"],
        globIgnores: ["**/og-baby-tracker.png"],
        sourcemap: false,
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    // Dev-only: /api lives in the deployed worker (same-origin in production).
    proxy: {
      "/api": {
        target: "https://numa-baby.mpoapostolis.workers.dev",
        changeOrigin: true,
      },
    },
  },
});
