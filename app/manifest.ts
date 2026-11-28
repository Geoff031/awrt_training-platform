import type { MetadataRoute } from "next";

// Lets runners add the site to their phone's home screen like an app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AWRT Training",
    short_name: "AWRT",
    description: "Running training plans, your calendar and your run history",
    start_url: "/my-plan",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
