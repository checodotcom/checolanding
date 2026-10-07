// Worker de checodotcom. Solo atiende POST /api/contact; todo lo demás son archivos estáticos
// de dist/ (wrangler.jsonc: assets.run_worker_first = ["/api/*"]).
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage, Mailbox } from "mimetext";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  CONTACT_EMAIL: { send(message: EmailMessage): Promise<void> };
  DB: { prepare(query: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } };
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
  try {
    await env.DB.prepare("INSERT INTO contactos (nombre, correo, mensaje) VALUES (?1, ?2, ?3)")
      .bind(name, email, message)
      .run();
    saved = true;
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.error("[contact] no se pudo guardar:", e?.name, e?.message); // sin datos del visitante
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
    mime.addMessage({
      contentType: "text/plain",
      // El cuerpo lleva acentos y ñ: 7bit podría mostrarse mal. mimetext solo escribe la cabecera,
      // así que el contenido se codifica aquí (UTF-8 → base64, en líneas de 76 caracteres).
      encoding: "base64",
      data: toBase64Utf8([`Nombre: ${name}`, `Correo: ${email}`, "", message || "(sin mensaje)"].join("\n")),
    });
    await env.CONTACT_EMAIL.send(new EmailMessage(env.MAIL_FROM, env.MAIL_TO, mime.asRaw()));
    sent = true;
  } catch (err) {
    // Solo el motivo técnico: nunca el nombre, el correo ni el mensaje del visitante.
    const e = err as { name?: string; code?: string; message?: string };
    console.error("[contact] no se pudo enviar:", e?.name, e?.code, e?.message, "| MAIL_TO definido:", Boolean(env.MAIL_TO));
  }

  // Error solo si no quedó ningún rastro: ni guardado ni avisado.
  if (!saved && !sent) return json({ ok: false }, 502);
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/contact") return handleContact(request, env);
    return env.ASSETS.fetch(request);
  },
};
