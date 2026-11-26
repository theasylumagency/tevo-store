import "server-only";
import type { SendResult } from "./sms";

export interface EmailMessage { to: string; subject: string; text: string; html?: string | null }

export interface EmailSender {
  id: string;
  send(msg: EmailMessage): Promise<SendResult>;
}

const consoleEmail: EmailSender = {
  id: "console",
  async send(msg) {
    console.info(JSON.stringify({ email: msg.to, subject: msg.subject }));
    return { ok: true, provider: "console", ref: null };
  },
};

let transporter: import("nodemailer").Transporter | null = null;

/** Any SMTP server. Purelymail: smtp.purelymail.com, 465 (SSL/TLS), full address + password. */
function smtp(): EmailSender {
  return {
    id: "smtp",
    async send(msg) {
      try {
        if (!transporter) {
          const nodemailer = await import("nodemailer");
          const port = Number(process.env.SMTP_PORT ?? 465);
          transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST ?? "smtp.purelymail.com", port, secure: port === 465,
            auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
            connectionTimeout: 15000, greetingTimeout: 15000,
          });
        }
        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM ?? process.env.SMTP_USER, replyTo: process.env.EMAIL_REPLY_TO || undefined,
          to: msg.to, subject: msg.subject, text: msg.text, html: msg.html ?? undefined,
        });
        return { ok: true, provider: "smtp", ref: info.messageId ?? null };
      } catch (e) {
        return { ok: false, provider: "smtp", error: String(e) };
      }
    },
  };
}

/** EMAIL_TRANSPORT=console → log only, off → never send; otherwise SMTP once SMTP_USER/SMTP_PASS are set. */
export function getEmailSender(): EmailSender | null {
  const kind = process.env.EMAIL_TRANSPORT;
  if (kind === "off") return null;
  if (kind === "console") return consoleEmail;
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return smtp();
  if (kind === "smtp") console.warn("EMAIL_TRANSPORT=smtp but SMTP_USER / SMTP_PASS are missing: e-mail is off");
  return process.env.NODE_ENV === "production" ? null : consoleEmail;
}
