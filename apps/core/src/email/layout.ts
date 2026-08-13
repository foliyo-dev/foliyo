/** Shared HTML shell for Foliyo transactional email (table layout for clients). */

/** Keep in sync with @foliyo/brand/tokens.css */
const BRAND = {
  primary: "#534ab7",
  primaryHover: "#4339a0",
  primaryMuted: "#7f77dd",
  accent: "#e8c547",
  bg: "#f8f7fc",
  surface: "#ffffff",
  text: "#1a1a2e",
  muted: "#5c5b66",
  border: "#e4e2ef",
  danger: "#b91c1c",
} as const;

export type EmailCta = {
  label: string;
  url: string;
  /** Danger-styled button (e.g. cancel deletion). */
  variant?: "primary" | "danger";
};

export type TransactionalEmail = {
  /** Inbox preview text (hidden in body). */
  preheader?: string;
  title: string;
  /** One or more HTML blocks (paragraphs, lists) — already escaped as needed. */
  paragraphs: string[];
  cta?: EmailCta;
  /** Secondary link shown under the button. */
  secondaryLink?: { label: string; url: string };
  footnote?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Safe paragraph from plain text (newlines become line breaks). */
export function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${BRAND.text};">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
}

/** Unescaped HTML paragraph — use only for trusted markup. */
export function pHtml(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${BRAND.text};">${html}</p>`;
}

export function ul(items: string[]): string {
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-size:15px;line-height:1.5;color:${BRAND.text};">${escapeHtml(item)}</li>`,
    )
    .join("");
  return `<ul style="margin:0 0 16px;padding-left:20px;">${lis}</ul>`;
}

function buttonHtml(cta: EmailCta): string {
  const bg = cta.variant === "danger" ? BRAND.danger : BRAND.primary;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">` +
    `<tr><td style="border-radius:8px;background:${bg};">` +
    `<a href="${escapeHtml(cta.url)}" ` +
    `style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;">` +
    `${escapeHtml(cta.label)}</a>` +
    `</td></tr></table>`
  );
}

/** Build multipart-ready HTML for a Foliyo transactional message. */
export function renderTransactionalEmail(mail: TransactionalEmail): string {
  const preheader = mail.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(mail.preheader)}</div>`
    : "";

  const body = mail.paragraphs.join("");
  const cta = mail.cta ? buttonHtml(mail.cta) : "";
  const secondary = mail.secondaryLink
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${BRAND.muted};">` +
      `<a href="${escapeHtml(mail.secondaryLink.url)}" style="color:${BRAND.primary};text-decoration:underline;">` +
      `${escapeHtml(mail.secondaryLink.label)}</a></p>`
    : "";
  const footnote = mail.footnote
    ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${BRAND.border};font-size:13px;line-height:1.5;color:${BRAND.muted};">${escapeHtml(mail.footnote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(mail.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 28px;background:${BRAND.primary};">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:0.02em;color:#ffffff;">Foliyo</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;line-height:1.3;color:${BRAND.text};">${escapeHtml(mail.title)}</h1>
            ${body}
            ${cta}
            ${secondary}
            ${footnote}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
              Foliyo — your folio, your way.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
