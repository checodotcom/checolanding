import { sanityClient } from "sanity:client";
import { createImageUrlBuilder } from "@sanity/image-url";

export interface Project {
  name: string;
  type: string;
  year: number;
  month: number; // 1–12
  desc: string;
  demo: boolean; // se lista en la columna «Demos», no entre los proyectos
  url?: string; // enlace al proyecto; sin URL no se genera enlace
  image?: string; // URL de la imagen; sin imagen se muestra el placeholder
  placeholder: string;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const formatDate = (p: Pick<Project, "year" | "month">) => `${MONTHS[p.month - 1]} ${p.year}`;

// Datos de ejemplo: se usan solo si Sanity falla o no tiene proyectos todavía.
// TODO: quitar cuando el contenido real esté publicado en Sanity.
const sample: Project[] = [
  { name: "Clínica quiropráctica", type: "Demo", year: 2026, month: 10, desc: "Sitio de conversión · Astro + Go High Level", demo: true, placeholder: "[imagen]" },
  { name: "Framewear", type: "Shopify", year: 2026, month: 9, desc: "Sitio de marca para una marca de ropa", demo: false, placeholder: "[imagen]" },
  { name: "Private Club", type: "Editorial", year: 2026, month: 8, desc: "Rediseño editorial de un blog de música", demo: false, placeholder: "[imagen]" },
];

const builder = createImageUrlBuilder(sanityClient);

// El desempate por _createdAt fija el orden entre proyectos del mismo mes (el sort de abajo es estable).
const query = `*[_type == "project"] | order(year desc, month desc, _createdAt desc){ name, type, year, month, "desc": description, demo, url, image }`;

async function fetchProjects(): Promise<Project[]> {
  try {
    const rows = await sanityClient.fetch<
      Array<Omit<Project, "image" | "placeholder" | "url" | "demo"> & { demo?: boolean | null; url?: string | null; image?: { asset?: unknown } }>
    >(query);
    if (!rows.length) return sample;
    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      year: r.year,
      month: r.month,
      desc: r.desc,
      // Demo si así se marcó en Sanity o si su etiqueta incluye «Demo».
      demo: r.demo === true || /\bdemo\b/i.test(r.type),
      url: r.url || undefined,
      image: r.image?.asset ? builder.image(r.image).width(1618).auto("format").url() : undefined,
      placeholder: "[imagen]",
    }));
  } catch (err) {
    console.warn("[sanity] No se pudieron leer los proyectos, uso datos de ejemplo:", (err as Error).message);
    return sample;
  }
}

// Más reciente primero. Nunca se numeran.
export const getProjects = async (): Promise<Project[]> =>
  (await fetchProjects()).sort((a, b) => b.year - a.year || b.month - a.month);

// URLs independientes del orden cronológico de los proyectos.
export const projectSlug = (project: Project): string => project.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
