import { sanityClient } from "sanity:client";

export interface Settings {
  email?: string;
  social: { label: string; url?: string }[];
}

// Lo que falte en Sanity se muestra como [placeholder] y sin enlace.
const fallback: Settings = {
  email: undefined,
  social: [{ label: "Instagram" }, { label: "GitHub" }, { label: "LinkedIn" }],
};

export async function getSettings(): Promise<Settings> {
  try {
    const doc = await sanityClient.fetch<Partial<Settings> | null>(
      `*[_id == "siteSettings"][0]{ email, social[]{ label, url } }`,
    );
    return {
      email: doc?.email || undefined,
      social: doc?.social?.length ? doc.social : fallback.social,
    };
  } catch (err) {
    console.warn("[sanity] No se pudieron leer los ajustes:", (err as Error).message);
    return fallback;
  }
}
