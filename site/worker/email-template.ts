// Correo de aviso de un contacto nuevo. HTML con estilos en línea (los clientes de correo no
// leen hojas de estilo) y tablas para el maquetado, con la paleta del sitio. Las fuentes del sitio
// no existen en el correo: Georgia y la sans del sistema hacen de respaldo.

export interface ContactMail {
  name: string;
  email: string;
  message: string;
  date: string; // ya legible, en hora de Ciudad de México
  id?: number; // id en la lista de contactos, si se guardó
}

// Todo lo que escribe el visitante se escapa: nunca se inserta tal cual en el HTML.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export function renderContactMail({ name, email, message, date, id }: ContactMail) {
  const n = esc(name);
  const e = esc(email);
  const body = message ? esc(message).replace(/\r?\n/g, "<br>") : `<span style="color:#828280;">(sin mensaje)</span>`;
  const reply = `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent("Re: tu mensaje en checodot.com")}`;
  const foot = id ? `Contacto n.º ${id} · ${esc(date)}` : esc(date);

  const label = `font:500 13px/21px ${SANS};letter-spacing:0.06em;text-transform:uppercase;color:#666664;`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Contacto: ${n}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f3;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f5f5f3;">${n} te escribió desde checodot.com</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f3;">
  <tr><td align="center" style="padding:34px 13px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
      <tr><td style="padding:0 0 21px 0;font:400 26px/34px ${SERIF};letter-spacing:-0.02em;color:#828280;">checodotcom</td></tr>
      <tr><td style="background:#fbfbfa;border:1px solid #dcdcda;border-radius:8px;padding:34px;">
        <p style="margin:0;${label}">Nuevo contacto</p>
        <p style="margin:13px 0 0 0;font:400 34px/42px ${SERIF};color:#262626;word-break:break-word;">${n}</p>
        <p style="margin:8px 0 0 0;font:400 16px/26px ${SANS};color:#4a4a48;"><a href="mailto:${e}" style="color:#4a4a48;text-decoration:underline;">${e}</a></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:21px 0;"><tr><td style="border-top:1px solid #dcdcda;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>
        <p style="margin:0 0 8px 0;${label}">Mensaje</p>
        <p style="margin:0;font:400 16px/26px ${SANS};color:#262626;word-break:break-word;">${body}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:34px 0 0 0;"><tr>
          <td style="background:#ffffff;border:1px solid #dcdcda;border-radius:8px;">
            <a href="${esc(reply)}" style="display:inline-block;padding:13px 21px;font:400 16px/26px ${SANS};color:#4a4a48;text-decoration:none;">Responder</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:21px 0 0 0;font:400 13px/21px ${SANS};color:#666664;">${foot}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    "NUEVO CONTACTO",
    "",
    `Nombre: ${name}`,
    `Correo: ${email}`,
    "",
    message || "(sin mensaje)",
    "",
    "—",
    id ? `Contacto n.º ${id} · ${date}` : date,
  ].join("\n");

  return { html, text };
}
