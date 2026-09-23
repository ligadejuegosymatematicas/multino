export const APP_NAME = "MULTINÓ";

export const APP_DESCRIPTION =
  "Dominó por equipos donde las puntas múltiplos de 5 puntúan.";

export function createWebManifest() {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#071b1b",
    theme_color: "#071b1b",
    icons: [
      {
        src: "./assets/brand/multino_isotipo_original_192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "./assets/brand/multino_isotipo_original_512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
export const RULESET_VERSION = "2026.09";
