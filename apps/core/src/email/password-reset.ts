import { nanoid } from "nanoid";
import { queryOne, run, type FoliyoDb } from "../db.js";
import type { Config } from "../config.js";
import { p, renderTransactionalEmail } from "./layout.js";
import { sendMail } from "./send.js";

const RESET_HOURS = 1;

export async function createPasswordResetToken(db: FoliyoDb, userId: string): Promise<string> {
  const token = nanoid(32);
  const expires = new Date();
  expires.setHours(expires.getHours() + RESET_HOURS);
  await run(
    db,
    `UPDATE users SET password_reset_token = ?, password_reset_expires = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [token, expires.toISOString(), userId],
  );
  return token;
}

export async function clearPasswordResetToken(db: FoliyoDb, userId: string): Promise<void> {
  await run(
    db,
    `UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId],
  );
}

export async function findUserByResetToken(
  db: FoliyoDb,
  token: string,
): Promise<{ id: string; email: string } | null> {
  return (
    (await queryOne<{ id: string; email: string }>(
      db,
      `SELECT id, email FROM users
       WHERE password_reset_token = ? AND password_reset_expires > CURRENT_TIMESTAMP`,
      [token],
    )) ?? null
  );
}

export async function sendPasswordResetEmail(
  config: Config,
  opts: { to: string; resetUrl: string },
): Promise<void> {
  const text =
    `Reset your Foliyo password\n\n` +
    `Click this link to choose a new password (expires in ${RESET_HOURS} hour):\n` +
    `${opts.resetUrl}\n\n` +
    `If you did not request this, you can ignore this email. Your password will not change.`;

  const html = renderTransactionalEmail({
    preheader: `Reset your Foliyo password — this link expires in ${RESET_HOURS} hour.`,
    title: "Reset your password",
    paragraphs: [
      p("We received a request to reset the password for this Foliyo account."),
      p(`This link expires in ${RESET_HOURS} hour.`),
    ],
    cta: { label: "Choose a new password", url: opts.resetUrl },
    secondaryLink: { label: "Or open this link in your browser", url: opts.resetUrl },
    footnote: "If you did not request this, you can ignore this email. Your password will not change.",
  });

  await sendMail(config, {
    to: opts.to,
    subject: "Reset your Foliyo password",
    text,
    html,
  });
}
