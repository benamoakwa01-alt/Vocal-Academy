import nodemailer from "nodemailer";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Sends a branded email through the academy Gmail account. Server-only.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  path?: string;
  buttonLabel?: string;
}) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) {
    console.warn("Email is not configured (GMAIL_USER / GMAIL_APP_PASSWORD).");
    return false;
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const link = site && opts.path ? `${site}${opts.path}` : null;

  const button = link
    ? `<p style="margin:24px 0 0"><a href="${link}" style="display:inline-block;background:#bfa26b;color:#0b1423;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(opts.buttonLabel ?? "Open the academy")}</a></p>`
    : "";
  const html = `<div style="background:#0b1423;padding:24px"><div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden"><div style="background:#0b1423;color:#ead39e;padding:16px 24px;font-family:Georgia,serif;font-size:18px">Pneuma Music Academy</div><div style="padding:24px;color:#1a1a1a;font-family:Arial,sans-serif;line-height:1.5"><h2 style="margin:0 0 12px">${esc(opts.heading)}</h2><p style="margin:0">${esc(opts.body).replace(/\n/g, "<br>")}</p>${button}</div></div></div>`;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `"Pneuma Music Academy" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: `${opts.heading}\n\n${opts.body}${link ? `\n\n${link}` : ""}`,
    html,
  });
  return true;
}
