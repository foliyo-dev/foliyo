import nodemailer from "nodemailer";
import type { Config } from "../config.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Hidden copies (customer invoice BCC — prefer separate internal mail for CA). */
  bcc?: string | string[];
  /** Optional file attachments (e.g. GST invoice PDF). */
  attachments?: Array<{
    filename: string;
    content: Buffer | Uint8Array;
    contentType?: string;
  }>;
}

export function isSmtpConfigured(config: Config): boolean {
  return Boolean(config.smtpHost && config.fromEmail);
}

/** Local catchers (MailHog / Mailpit) speak plain SMTP — no STARTTLS. */
function isDevCatcher(config: Config): boolean {
  return config.smtpIgnoreTls || config.smtpPort === 1025 || config.smtpPort === 1026;
}

/** Send transactional mail. Without SMTP, logs the message (dev-friendly). */
export async function sendMail(
  config: Config,
  message: MailMessage,
): Promise<{ ok: boolean; logged: boolean }> {
  if (!isSmtpConfigured(config)) {
    const bcc = message.bcc
      ? Array.isArray(message.bcc)
        ? message.bcc.join(", ")
        : message.bcc
      : "";
    console.log(
      `[foliyo:email] SMTP not configured — logging instead\n` +
        `  To: ${message.to}\n` +
        (bcc ? `  Bcc: ${bcc}\n` : "") +
        `  Subject: ${message.subject}\n` +
        `  ${message.text.replace(/\n/g, "\n  ")}` +
        (message.attachments?.length
          ? `\n  Attachments: ${message.attachments.map((a) => a.filename).join(", ")}`
          : ""),
    );
    return { ok: true, logged: true };
  }

  const catcher = isDevCatcher(config);
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser
      ? { user: config.smtpUser, pass: config.smtpPass }
      : undefined,
    ...(catcher
      ? { ignoreTLS: true, tls: { rejectUnauthorized: false } }
      : {}),
  });

  const info = await transporter.sendMail({
    from: config.fromEmail,
    to: message.to,
    bcc: message.bcc,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content),
      contentType: a.contentType,
    })),
  });

  console.log(
    `[foliyo:email] sent → ${message.to}` +
      (message.bcc
        ? ` (bcc: ${Array.isArray(message.bcc) ? message.bcc.join(", ") : message.bcc})`
        : "") +
      ` · ${message.subject}` +
      (info.messageId ? ` · id=${info.messageId}` : ""),
  );

  return { ok: true, logged: false };
}
