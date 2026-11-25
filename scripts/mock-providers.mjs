// Fake smsoffice.ge + SMTP server for tests. Records everything; GET http://localhost:3901/_log returns it.
//   node scripts/mock-providers.mjs   (SMS on :3901, SMTP on :2525)
// SMS_FAIL_CALL=N makes the N-th SMS request fail, to exercise retries.
import http from "node:http";
import { SMTPServer } from "smtp-server";

const log = { sms: [], email: [] };
let smsCalls = 0;

http.createServer((req, res) => {
  if (req.url === "/_log") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(log)); }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
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
console.log("mock providers: sms :3901, smtp :2525");
