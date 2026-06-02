import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Next auto-injects <link rel="manifest">.
// display: "standalone" is what makes the installed app open without the
// browser address bar. Icons point to the generated PNG routes in Task 2.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zakupy",
    short_name: "Zakupy",
    description: "Wewnętrzna aplikacja do zakupów",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "pl",
    dir: "ltr",
    background_color: "#f4f3ee",
    theme_color: "#1f8a52",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
