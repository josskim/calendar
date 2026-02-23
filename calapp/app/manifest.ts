import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smart Check-in StayNamchen",
    short_name: "StayNamchen",
    description: "Smart Check-in StayNamchen reservation management",
    start_url: "/admin/login",
    scope: "/",
    display: "standalone",
    background_color: "#f8f6f6",
    theme_color: "#123E6B",
    lang: "ko",
    icons: [
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
