import { defineField, defineType } from "sanity";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const project = defineType({
  name: "project",
  title: "Proyecto",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Nombre", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "type",
      title: "Tipo",
      description: "Etiqueta corta: Demo, Shopify, Editorial, Foto…",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "year",
      title: "Año de conclusión",
      type: "number",
      validation: (r) => r.required().integer().min(2000).max(2100),
    }),
    defineField({
      name: "month",
      title: "Mes de conclusión",
      type: "number",
      options: { list: MONTHS.map((title, i) => ({ title, value: i + 1 })), layout: "dropdown" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "description", title: "Descripción", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "image",
      title: "Imagen",
      description: "Se muestra en proporción 1.618 : 1; el recorte se ajusta solo.",
      type: "image",
      options: { hotspot: true },
    }),
  ],
  orderings: [
    {
      title: "Más reciente primero",
      name: "dateDesc",
      by: [
        { field: "year", direction: "desc" },
        { field: "month", direction: "desc" },
      ],
    },
  ],
  preview: {
    select: { title: "name", type: "type", year: "year", month: "month", media: "image" },
    prepare: ({ title, type, year, month, media }) => ({
      title,
      subtitle: `${MONTHS[(month ?? 1) - 1]} ${year ?? ""} · ${type ?? ""}`,
      media,
    }),
  },
});
