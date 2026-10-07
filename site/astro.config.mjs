import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sanity from "@sanity/astro";

// Sitio estático. React solo lo usa el Studio de Sanity, que vive en /admin.
// El projectId es público (no es un secreto).
export default defineConfig({
  integrations: [
    sanity({
      projectId: "0yp7ue4b",
      dataset: "production",
      apiVersion: "2025-01-01",
      useCdn: false, // build estático: siempre datos frescos
      studioBasePath: "/admin",
      studioRouterHistory: "hash", // necesario para que /admin funcione en hosting estático
    }),
    react(),
  ],
});
