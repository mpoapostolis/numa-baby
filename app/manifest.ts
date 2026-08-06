import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baby Tracker — Calm, private baby logging",
    short_name: "Baby Tracker",
    description: "Private, one-handed tracking for feeds, diapers, sleep and growth.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f5",
    theme_color: "#18332c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
