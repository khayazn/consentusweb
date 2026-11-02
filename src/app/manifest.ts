import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Consentus",
    short_name: "Consentus",
    description: "Consent-first dating and connections",
    start_url: "/",
    display: "standalone",
    background_color: "#F7FAFC",
    theme_color: "#6B46C1",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
