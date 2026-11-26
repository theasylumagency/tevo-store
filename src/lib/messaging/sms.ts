import "server-only";
import { translit } from "@/lib/translit";

export interface SendResult { ok: boolean; provider: string; ref?: string | null; error?: string }

export interface SmsSender {
  id: string;
  send(to: string, text: string): Promise<SendResult>;
}

/** Georgian SMS are UCS-2 (70 chars per segment); Latin transliteration fits 160 and costs less. */
export function prepareSmsText(text: string) {
  return process.env.SMS_ALPHABET === "latin" ? translit(text) : text;
}

const consoleSms: SmsSender = {
  id: "console",
  async send(to, text) {
    console.info(JSON.stringify({ sms: to, text }));
    return { ok: true, provider: "console", ref: null };
  },
};

/** smsoffice.ge — HTTP API v2. `urgent=true` marks transactional messages. */
function smsOffice(key: string, sender: string): SmsSender {
  return {
    id: "smsoffice",
    async send(to, text) {
      const destination = to.replace(/\D/g, "");          // 995XXXXXXXXX
      const body = new URLSearchParams({ key, destination, sender, content: text, urgent: "true" });
      const url = process.env.SMSOFFICE_URL ?? "https://smsoffice.ge/api/v2/send/";
      try {
        const res = await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(15000),
                                       headers: { "content-type": "application/x-www-form-urlencoded" } });
        const data = (await res.json().catch(() => null)) as { Success?: boolean; Message?: string; ErrorCode?: number; Output?: unknown } | null;
        if (res.ok && data?.Success) return { ok: true, provider: "smsoffice", ref: data.Output ? String(data.Output) : null };
        return { ok: false, provider: "smsoffice", error: `HTTP ${res.status} code=${data?.ErrorCode ?? "?"} ${data?.Message ?? ""}`.trim() };
      } catch (e) {
        return { ok: false, provider: "smsoffice", error: String(e) };
      }
    },
  };
}

/**
 * SMS_PROVIDER=console → log only (development), off → never send.
 * Otherwise smsoffice.ge is used as soon as SMSOFFICE_API_KEY and SMS_SENDER are set; until then SMS is simply off
 * (messages are recorded as "skipped — not configured" and visible on the order in the admin).
 */
export function getSmsSender(): SmsSender | null {
  const kind = process.env.SMS_PROVIDER;
  if (kind === "off") return null;
  if (kind === "console") return consoleSms;
  const key = process.env.SMSOFFICE_API_KEY, sender = process.env.SMS_SENDER;
  if (key && sender) return smsOffice(key, sender);
  if (kind === "smsoffice") console.warn("SMS_PROVIDER=smsoffice but SMSOFFICE_API_KEY / SMS_SENDER are missing: SMS are off");
  return process.env.NODE_ENV === "production" ? null : consoleSms;
}
