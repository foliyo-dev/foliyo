import { nanoid } from "nanoid";
import { queryOne, run, type FoliyoDb } from "../db.js";
import type { Config } from "../config.js";
import { p, renderTransactionalEmail, ul } from "./layout.js";
import { sendMail } from "./send.js";

const VERIFY_HOURS = 24;

export function createEmailVerifyToken(db: FoliyoDb, userId: string): string {
  const token = nanoid(32);
  const expires = new Date();
  expires.setHours(expires.getHours() + VERIFY_HOURS);
  run(
    db,
    `UPDATE users SET email_verify_token = ?, email_verify_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [token, expires.toISOString(), userId],
  );
  return token;
}

export function clearEmailVerifyToken(db: FoliyoDb, userId: string): void {
  run(
    db,
    `UPDATE users SET email_verify_token = NULL, email_verify_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId],
  );
}

export function markEmailVerified(db: FoliyoDb, userId: string): void {
  run(
    db,
    `UPDATE users SET email_verified = 1, email_verify_token = NULL, email_verify_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId],
  );
}

export function findUserByVerifyToken(
  db: FoliyoDb,
  token: string,
): { id: string; email: string; email_verified: number } | null {
  return (
    queryOne<{ id: string; email: string; email_verified: number }>(
      db,
      `SELECT id, email, email_verified FROM users
       WHERE email_verify_token = ? AND email_verify_expires > CURRENT_TIMESTAMP`,
      [token],
    ) ?? null
  );
}

export async function sendVerificationEmail(
  config: Config,
  opts: { to: string; verifyUrl: string },
): Promise<void> {
  const text =
    `Verify your Foliyo account\n\n` +
    `Click this link to verify your email (expires in ${VERIFY_HOURS} hours):\n` +
    `${opts.verifyUrl}\n\n` +
    `If you did not create a Foliyo account, you can ignore this email.`;

  const html = renderTransactionalEmail({
    preheader: `Confirm your email within ${VERIFY_HOURS} hours to activate Foliyo.`,
    title: "Verify your email",
    paragraphs: [
      p("Thanks for signing up for Foliyo. Confirm your email address to finish creating your account."),
      p(`This link expires in ${VERIFY_HOURS} hours.`),
    ],
    cta: { label: "Verify email", url: opts.verifyUrl },
    secondaryLink: { label: "Or open this link in your browser", url: opts.verifyUrl },
    footnote: "If you did not create a Foliyo account, you can ignore this email.",
  });

  await sendMail(config, {
    to: opts.to,
    subject: "Verify your Foliyo account",
    text,
    html,
  });
}

export async function sendWelcomeEmail(
  config: Config,
  opts: { to: string; name?: string; dashboardUrl: string },
): Promise<void> {
  const greeting = opts.name?.trim() ? opts.name.trim() : "there";
  const text =
    `Welcome to Foliyo, ${greeting}!\n\n` +
    `Your email is verified. Next steps:\n` +
    `1. Claim your handle and finish onboarding\n` +
    `2. Add projects and experience to your library\n` +
    `3. Publish a portfolio and share a resume link\n\n` +
    `Open your dashboard: ${opts.dashboardUrl}\n`;

  const html = renderTransactionalEmail({
    preheader: "Your email is verified — finish onboarding and publish your folio.",
    title: `Welcome to Foliyo, ${greeting}!`,
    paragraphs: [
      p("Your email is verified. Here is a short path to a shareable portfolio:"),
      ul([
        "Claim your handle and finish onboarding",
        "Add projects and experience to your library",
        "Publish a portfolio and share a resume link",
      ]),
    ],
    cta: { label: "Open dashboard", url: opts.dashboardUrl },
  });

  await sendMail(config, {
    to: opts.to,
    subject: `Welcome to Foliyo, ${greeting}!`,
    text,
    html,
  });
}

export function markWelcomeEmailSent(db: FoliyoDb, userId: string): void {
  run(
    db,
    `UPDATE users SET welcome_email_sent = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId],
  );
}
