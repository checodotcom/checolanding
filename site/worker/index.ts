// Worker de checodotcom. Solo atiende POST /api/contact; todo lo demás son archivos estáticos
// de dist/ (wrangler.jsonc: assets.run_worker_first = ["/api/*"]).
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage, Mailbox } from "mimetext";
import { renderContactMail } from "./email-template";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  CONTACT_EMAIL: { send(message: EmailMessage): Promise<void> };
  DB: {
    prepare(query: string): {
      bind(...values: unknown[]): { run(): Promise<{ meta?: { last_row_id?: number } }> };
    };
  };
  MAIL_FROM: string; // remitente en el dominio con Email Routing (var en wrangler.jsonc)
  MAIL_TO: string; // destino verificado en Email Routing (secreto en el panel de Cloudflare)
  ALLOWED_ORIGINS: string; // orígenes permitidos separados por coma
}

// Más estricto que el del formulario: sin caracteres que permitan colar direcciones extra en Reply-To.
const EMAIL = /^[^\s@<>,;:"()[\]\\]+@[^\s@<>,;:"()[\]\\]+\.[^\s@<>,;:"()[\]\\]{2,}$/;
const MAX_BODY = 4096;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

// Quita saltos de línea y caracteres de control: evita inyección de cabeceras en el correo.
const clean = (s: unknown, max: number) =>
  String(s ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);

// Hora de Ciudad de México calculada con la zona horaria (no un desfase fijo), para que siga
// bien si México vuelve a cambiar de horario. Formato "2026-10-07 16:28:20" (lo guarda D1).
const MX = "America/Mexico_City";
const dbTime = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: MX, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(d);
// Versión legible para el correo: "7 de octubre de 2026, 16:28 (hora de Ciudad de México)".
const mailTime = (d: Date) =>
  `${new Intl.DateTimeFormat("es-MX", { timeZone: MX, dateStyle: "long", timeStyle: "short", hour12: false }).format(d)} (hora de Ciudad de México)`;

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return (btoa(binary).match(/.{1,76}/g) ?? []).join("\r\n");
}

async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false }, 405, { Allow: "POST" });

  // Solo desde nuestro propio sitio (los navegadores siempre mandan Origin en un POST con fetch).
  const origin = request.headers.get("Origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  if (!allowed.includes(origin)) return json({ ok: false }, 403);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false }, 413);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ ok: false }, 400);
  }

  // Honeypot: un bot rellenó el campo invisible. Se responde "ok" para no darle pistas.
  if (clean(data.website, 50)) return json({ ok: true });

  const email = clean(data.email, 254);
  const name = clean(data.name, 120);
  // El mensaje conserva saltos de línea (solo se limpian caracteres de control).
  const message = String(data.message ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 250);

  if (!EMAIL.test(email) || name.length < 2) return json({ ok: false }, 400);

  // 1) Guardar primero: así el contacto no se pierde aunque falle el correo.
  let saved = false;
  let id: number | undefined;
  const now = new Date();
  try {
    const result = await env.DB.prepare("INSERT INTO contactos (creado_en, nombre, correo, mensaje) VALUES (?1, ?2, ?3, ?4)")
      .bind(dbTime(now), name, email, message)
      .run();
    id = result.meta?.last_row_id;
    saved = true;
  } catch (err) {
    const e = err as { name?: string; message?: string };
    // Los errores de D1/SQLite describen el esquema, no los valores enlazados; aun así se acota la
    // longitud y nunca se registran el nombre, el correo ni el mensaje del visitante.
    console.error("[contact] no se pudo guardar:", e?.name, String(e?.message ?? "").slice(0, 120));
  }

  // 2) Avisar por correo.
  let sent = false;
  try {
    const mime = createMimeMessage();
    mime.setSender({ name: "checodotcom", addr: env.MAIL_FROM });
    mime.setRecipient(env.MAIL_TO);
    // Reply-To exige una instancia de Mailbox (no texto ni objeto plano).
    mime.setHeader("Reply-To", new Mailbox({ name, addr: email }));
    mime.setSubject(`Contacto: ${name}`);
    const { html, text } = renderContactMail({ name, email, message, date: mailTime(now), id });
    // Versión de texto (respaldo) y HTML con estilo. El cuerpo lleva acentos y ñ: 7bit podría
    // mostrarse mal. mimetext solo escribe la cabecera, así que el contenido se codifica aquí
    // (UTF-8 → base64, en líneas de 76 caracteres).
    mime.addMessage({ contentType: "text/plain", encoding: "base64", data: toBase64Utf8(text) });
    mime.addMessage({ contentType: "text/html", encoding: "base64", data: toBase64Utf8(html) });
    await env.CONTACT_EMAIL.send(new EmailMessage(env.MAIL_FROM, env.MAIL_TO, mime.asRaw()));
    sent = true;
  } catch (err) {
    // Solo el motivo técnico: nunca el nombre, el correo ni el mensaje del visitante.
    const e = err as { name?: string; code?: string; message?: string };
    console.error("[contact] no se pudo enviar:", e?.name, e?.code, e?.message, "| MAIL_TO definido:", Boolean(env.MAIL_TO));
  }

  // Error solo si no quedó ningún rastro: ni guardado ni avisado.
  if (!saved && !sent) return json({ ok: false }, 502);
  // Guardado pero sin aviso: el visitante no tiene la culpa, pero tú te enteras solo si miras la
  // lista (D1) o los logs. Esta línea fija el rastro para buscarla en Observability.
  if (saved && !sent) console.error("[contact] ALERTA: contacto guardado sin aviso por correo, id:", id);
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/contact") return handleContact(request, env);
    return env.ASSETS.fetch(request);
  },
};
