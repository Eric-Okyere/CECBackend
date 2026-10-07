import nodemailer from "nodemailer";

/**
 * Sends account emails through Resend (https://resend.com).
 *
 * Required env vars:
 *   RESEND_API_KEY  - from the Resend dashboard (API Keys)
 *   EMAIL_FROM      - a sender on a domain verified in Resend, e.g.
 *                     "CEC Extra Classes <no-reply@cecextraclasses.com>"
 *
 * If RESEND_API_KEY is not set, falls back to Gmail (EMAIL_USER / EMAIL_PASS),
 * which is fine for local development but limited to ~500 emails a day.
 */

const BRAND = "CEC Extra Classes";
const INK = "#23277f";

const codeEmail = ({ heading, intro, code, footer }) => {
  const safeCode = String(code).replace(/\D/g, "");
  const text = `${heading}\n\n${intro}\n\n${safeCode}\n\nThis code expires in 10 minutes.\n${footer}\n\n${BRAND}`;
  const html = `
  <div style="background:#f4f6fb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1f2340">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #d3e2f4">
      <p style="margin:0 0 4px;font-size:14px;color:#4a4f6a">${BRAND}</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:${INK}">${heading}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5">${intro}</p>
      <p style="margin:0 0 24px;font-size:36px;font-weight:bold;letter-spacing:8px;color:${INK};text-align:center;background:#f4f6fb;border-radius:12px;padding:16px 0">${safeCode}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#4a4f6a">This code expires in 10 minutes.</p>
      <p style="margin:0;font-size:14px;color:#4a4f6a">${footer}</p>
    </div>
  </div>`;
  return { text, html };
};

const sendWithResend = async ({ to, subject, html, text }) => {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not configured.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
};

let gmail;
const sendWithGmail = async ({ to, subject, html, text }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("No email provider configured (set RESEND_API_KEY and EMAIL_FROM).");
  }
  gmail ||= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return gmail.sendMail({ from: `"${BRAND}" <${process.env.EMAIL_USER}>`, to, subject, html, text });
};

const send = (message) =>
  process.env.RESEND_API_KEY ? sendWithResend(message) : sendWithGmail(message);

export const sendVerificationEmail = (email, code) =>
  send({
    to: email,
    subject: `Your ${BRAND} verification code`,
    ...codeEmail({
      heading: "Confirm your email",
      intro: "Welcome! Enter this code on the verification page to finish creating your account.",
      code,
      footer: "If you did not sign up, you can ignore this email.",
    }),
  });

export const sendPasswordResetEmail = (email, code) =>
  send({
    to: email,
    subject: `Reset your ${BRAND} password`,
    ...codeEmail({
      heading: "Reset your password",
      intro: "Enter this code on the reset page, then choose a new password.",
      code,
      footer: "If you did not ask to reset your password, you can ignore this email. Your password has not changed.",
    }),
  });
