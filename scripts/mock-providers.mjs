// Fake smsoffice.ge + SMTP server for tests. Records everything; GET http://localhost:3901/_log returns it.
//   node scripts/mock-providers.mjs   (SMS on :3901, SMTP on :2525)
// SMS_FAIL_CALL=N makes the N-th SMS request fail, to exercise retries.
// Telegram Bot API: TELEGRAM_API_BASE=http://localhost:3901 → /bot<token>/<method> is answered here too.
import http from "node:http";
import { SMTPServer } from "smtp-server";

const log = { sms: [], email: [], telegram: [] };
let smsCalls = 0, tgMessages = 0, webhook = "";

function telegram(method, p) {
  if (method === "getMe") return { ok: true, result: { id: 1, is_bot: true, username: "rodo_test_bot" } };
  if (method === "setWebhook") { webhook = p.url; log.telegram.push({ method, url: p.url, secret: Boolean(p.secret_token) }); return { ok: true, result: true }; }
  if (method === "getWebhookInfo") return { ok: true, result: { url: webhook, pending_update_count: 0 } };
  if (method === "sendMessage") {
    if (String(p.chat_id) === "403") return { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" };
    log.telegram.push({ method, chat: String(p.chat_id), text: p.text, parse_mode: p.parse_mode, buttons: p.reply_markup ?? null });
    return { ok: true, result: { message_id: ++tgMessages } };
  }
  return { ok: false, error_code: 404, description: "Not Found" };
}

http.createServer((req, res) => {
  if (req.url === "/_log") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(log)); }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const tg = /^\/bot[^/]+\/(\w+)$/.exec(req.url ?? "");
    if (tg) { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(telegram(tg[1], body ? JSON.parse(body) : {}))); }
    const p = new URLSearchParams(body);
    smsCalls++;
    const fail = Number(process.env.SMS_FAIL_CALL ?? 0) === smsCalls;
    log.sms.push({ to: p.get("destination"), sender: p.get("sender"), text: p.get("content"), urgent: p.get("urgent"), ok: !fail });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(fail ? { Success: false, Message: "Temporary delay", ErrorCode: -100 }
                                : { Success: true, Message: "OK", Output: `id-${smsCalls}`, ErrorCode: 0 }));
  });
}).listen(3901);

new SMTPServer({
  authOptional: true, disabledCommands: ["STARTTLS"],
  onAuth(auth, _s, cb) { cb(null, { user: auth.username }); },
  onData(stream, session, cb) {
    let raw = "";
    stream.on("data", (c) => (raw += c));
    stream.on("end", () => {
      const header = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, " ");
      const subj = (/^Subject: (.*)$/m.exec(header)?.[1] ?? "")
        .replace(/=\?UTF-8\?B\?([^?]+)\?=\s*/gi, (_, b) => Buffer.from(b, "base64").toString("utf8"));
      log.email.push({ to: session.envelope.rcptTo.map((r) => r.address), subject: subj, size: raw.length,
                       hasHtml: /text\/html/i.test(raw) });
      cb();
    });
  },
}).listen(2525);
console.log("mock providers: sms + telegram :3901, smtp :2525");
