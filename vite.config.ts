import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const APP_VERSION = new Date().toISOString().slice(0, 16).replace("T", " ");

export default defineConfig({
  // Stamped at build time so a bug report names the build it came from.
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    // The latin subset of the typeface, preloaded. Vite hashes the file name,
    // so the tag is written from the bundle at build time. Without it the
    // font was discovered only after the stylesheet had been parsed, and the
    // first paint was in the system face with a swap mid-read.
    {
      name: "preload-latin-font",
      transformIndexHtml: {
        order: "post",
        handler(_html, ctx) {
          if (!ctx.bundle) return;
          const file = Object.keys(ctx.bundle).find((name) => /geist-latin-wght-normal.*\.woff2$/.test(name));
          if (!file) return;
          return [{
            tag: "link",
            attrs: { rel: "preload", as: "font", type: "font/woff2", href: `/${file}`, crossorigin: "" },
            injectTo: "head",
          }];
        },
      },
    },
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      // The 512px icons are read by the OS once, at install; keeping them out
      // of the precache (see globIgnores) spares every first visit their
      // download. The 192s are precached through the glob like anything else.
      includeAssets: ["favicon.svg"],
      // Otherwise every icon the manifest names is precached regardless of
      // the glob rules below — which is exactly how the 512s got in.
      includeManifestIcons: false,
      manifest: {
        name: "Numalog — Calm, private baby tracker",
        short_name: "Numalog",
        description: "Private, one-handed tracking for feeds, diapers, burping and growth.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // One-handed at 3am is the whole design; sideways is never that.
        orientation: "portrait",
        categories: ["health", "lifestyle", "medical"],
        // There is no native app to prefer, and saying so explicitly is what
        // lets store packagers (TWA) treat the PWA as the real thing.
        prefer_related_applications: false,
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
        // Worker and must reach the network, and the prerendered content
        // pages, which are the whole point of being findable at all: a person
        // arriving from a search result must get the article they clicked,
        // not the app shell wearing its URL.
        navigateFallbackDenylist: [
          /^\/admin/,
          /^\/api\//,
          /^\/guides/,
          /^\/sources/,
          /^\/newborn/,
          /^\/\d+-(weeks|months)/,
          /^\/1-year/,
          /^\/when-to-call-a-doctor/,
          /^\/how-much-milk/,
          /^\/baby-bag-checklist/,
          // Any file with an extension (sitemap.xml, robots.txt, llms.txt…):
          // navigating to a FILE must show the file, not the app wearing
          // its URL.
          /\.[a-z0-9]+$/i,
        ],
        // woff2 too: the typeface is part of the offline promise. An installed
        // app opened after the HTTP cache had been evicted rendered in the
        // system face with Geist's tracking applied to the wrong letters.
        // Only the latin subsets, though — cyrillic and vietnamese never
        // render an English UI and unicode-range keeps them lazy online.
        globPatterns: ["**/*.{html,js,css,png,svg,webmanifest,woff2}"],
        globIgnores: [
          "**/og-baby-tracker.png",
          "**/icon-512.png",
          "**/icon-maskable-512.png",
          "**/geist-cyrillic-*.woff2",
          "**/geist-cyrillic-ext-*.woff2",
          "**/geist-vietnamese-*.woff2",
        ],
        // The soothing sounds are ~1.5MB of media nobody should pay for at
        // install time — cached on first play instead, then they work
        // offline like everything else.
        runtimeCaching: [
          {
            urlPattern: /\/sounds\/.*\.(wav|m4a)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "numalog-sounds",
              expiration: { maxEntries: 12 },
            },
          },
        ],
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
    // Dev-only. /api and /admin live in the Worker, which Vite does not run —
    // without this they fall through to the SPA and render the app instead.
    proxy: {
      "/api": {
        target: "https://numa-baby.mpoapostolis.workers.dev",
        changeOrigin: true,
      },
      "/admin": {
        target: "https://numa-baby.mpoapostolis.workers.dev",
        changeOrigin: true,
      },
    },
  },
});
