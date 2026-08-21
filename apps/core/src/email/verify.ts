import { nanoid } from "nanoid";
import { queryOne, run, type FoliyoDb } from "../db.js";
import type { Config } from "../config.js";
import { p, renderTransactionalEmail, ul } from "./layout.js";
import { sendMail } from "./send.js";
import { hashSecret } from "../auth/secret.js";
import { sqlUtc, sqlUtcPlusHours } from "../auth/datetime.js";

const VERIFY_HOURS = 24;

export async function createEmailVerifyToken(db: FoliyoDb, userId: string): Promise<string> {
  const token = nanoid(32);
  await run(
    db,
    `UPDATE users SET email_verify_token = ?, email_verify_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [hashSecret(token), sqlUtcPlusHours(VERIFY_HOURS), userId],
  );
  return token;
}

export async function clearEmailVerifyToken(db: FoliyoDb, userId: string): Promise<void> {
  await run(
    db,
    `UPDATE users SET email_verify_token = NULL, email_verify_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId],
  );
}

export async function markEmailVerified(db: FoliyoDb, userId: string): Promise<void> {
  await run(
    db,
    `UPDATE users SET email_verified = 1, email_verify_token = NULL, email_verify_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId],
  );
}

export async function findUserByVerifyToken(
  db: FoliyoDb,
  token: string,
): Promise<{ id: string; email: string; email_verified: number } | null> {
  const now = sqlUtc();
  const hashed = hashSecret(token);
  return (
    (await queryOne<{ id: string; email: string; email_verified: number }>(
      db,
      `SELECT id, email, email_verified FROM users
       WHERE (email_verify_token = ? OR email_verify_token = ?) AND email_verify_expires > ?`,
      [hashed, token, now],
    )) ?? null
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

export async function sendPendingSignupEmail(
  config: Config,
  opts: { to: string; verifyUrl: string },
): Promise<void> {
  const text =
    `Finish creating your Foliyo account\n\n` +
    `Choose a password with this link (expires in 60 minutes):\n` +
    `${opts.verifyUrl}\n\n` +
    `If you did not request this, you can ignore this email.`;

  const html = renderTransactionalEmail({
    preheader: "Choose a password within 60 minutes to activate Foliyo.",
    title: "Finish creating your account",
    paragraphs: [
      p("Confirm your email and choose a password to finish creating your Foliyo account."),
      p("This link expires in 60 minutes."),
    ],
    cta: { label: "Choose a password", url: opts.verifyUrl },
    secondaryLink: { label: "Or open this link in your browser", url: opts.verifyUrl },
    footnote: "If you did not request this, you can ignore this email.",
  });

  await sendMail(config, {
    to: opts.to,
    subject: "Finish creating your Foliyo account",
    text,
    html,
  });
}

export async function sendAlreadyRegisteredEmail(
  config: Config,
  opts: { to: string; loginUrl: string },
): Promise<void> {
  const text =
    `Someone tried to sign up for Foliyo with this email, but an account already exists.\n\n` +
    `Sign in: ${opts.loginUrl}\n\n` +
    `If this was you, use the login page (or forgot password). If not, you can ignore this email.`;

  const html = renderTransactionalEmail({
    preheader: "An account already exists for this email.",
    title: "You already have a Foliyo account",
    paragraphs: [
      p("Someone tried to sign up with this email, but an account already exists."),
      p("Sign in with your password, or use forgot password if you need a reset link."),
    ],
    cta: { label: "Sign in", url: opts.loginUrl },
    footnote: "If this was not you, you can ignore this email.",
  });

  await sendMail(config, {
    to: opts.to,
    subject: "Your Foliyo account",
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

export async function markWelcomeEmailSent(db: FoliyoDb, userId: string): Promise<void> {
  await run(
    db,
    `UPDATE users SET welcome_email_sent = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId],
  );
}
