import nodemailer from "nodemailer";
import type { Config } from "../config.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function isSmtpConfigured(config: Config): boolean {
  return Boolean(config.smtpHost && config.fromEmail);
}

/** Send transactional mail. Without SMTP, logs the message (dev-friendly). */
export async function sendMail(
  config: Config,
  message: MailMessage,
): Promise<{ ok: boolean; logged: boolean }> {
  if (!isSmtpConfigured(config)) {
    console.log(
      `[foliyo:email] SMTP not configured — logging instead\n` +
        `  To: ${message.to}\n` +
        `  Subject: ${message.subject}\n` +
        `  ${message.text.replace(/\n/g, "\n  ")}`,
    );
    return { ok: true, logged: true };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: config.smtpUser
      ? { user: config.smtpUser, pass: config.smtpPass }
      : undefined,
  });

  await transporter.sendMail({
    from: config.fromEmail,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return { ok: true, logged: false };
}
