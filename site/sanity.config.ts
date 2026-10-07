import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./src/sanity/schemas";

// No definir basePath aquí: lo maneja la integración (/admin).
export default defineConfig({
  name: "checodotcom",
  title: "checodotcom",
  projectId: "0yp7ue4b",
  dataset: "production",
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Contenido")
          .items([
            S.listItem()
              .title("Ajustes del sitio")
              .id("siteSettings")
              .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
            S.documentTypeListItem("project").title("Proyectos"),
          ]),
    }),
  ],
  schema: { types: schemaTypes },
});
