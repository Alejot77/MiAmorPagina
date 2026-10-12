import nodemailer from "nodemailer";

// Los correos salen de una cuenta de Gmail con una "contraseña de
// aplicación" (no la clave normal de Google). Variables en Vercel:
//   GMAIL_USER          -> la direccion, ej. planesdedos@gmail.com
//   GMAIL_APP_PASSWORD  -> la contraseña de aplicacion de 16 letras
// Para usar otro proveedor por SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER,
// SMTP_PASS y MAIL_FROM (tienen prioridad sobre Gmail).
export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));
}

let transporter;

function createTransport() {
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT) || 587;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      // Google la muestra en grupos de 4 con espacios; se aceptan igual.
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ""),
    },
  });
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    throw new Error("El envío de correos no está configurado (faltan GMAIL_USER y GMAIL_APP_PASSWORD en Vercel).");
  }
  transporter ||= createTransport();
  const from = process.env.MAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER;
  await transporter.sendMail({ from: `"Plan de dos" <${from}>`, to, subject, text, html });
}
