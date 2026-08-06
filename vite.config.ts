import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { sites } from "./build/sites-vite-plugin.ts";

export default defineConfig({
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
        description: "Private, one-handed tracking for feeds, diapers, sleep and growth.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f4f7f5",
        theme_color: "#18332c",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: "/index.html",
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
  },
});
