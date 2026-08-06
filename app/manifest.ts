import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Numa — Calm baby tracking",
    short_name: "Numa",
    description: "Private, one-handed tracking for feeds, diapers and sleep.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f1ea",
    theme_color: "#1b2928",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
