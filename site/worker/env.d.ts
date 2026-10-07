// Tipos mínimos para el módulo de correo de Workers (no hay @cloudflare/workers-types instalado).
declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string);
  }
}
