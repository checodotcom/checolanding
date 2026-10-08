import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sanity from "@sanity/astro";

// Sitio estático. React solo lo usa el Studio de Sanity, que vive en /admin.
// El projectId es público (no es un secreto).
export default defineConfig({
  site: "https://checodot.com", // dominio público: las etiquetas Open Graph necesitan URLs absolutas
  // El CSS de la página va dentro del HTML (no en un archivo aparte): llega junto con el header y el
  // resto del contenido, así el navegador nunca pinta la página sin estilos mientras espera el CSS
  // (en móvil se veía un instante el header, que es lo primero del <body>, sin ocultar).
  build: { inlineStylesheets: "always" },
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
