import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";
const TTL_SECONDS = 60 * 60 * 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected === "change-me") return false;   // refuse the placeholder
  return safeEqual(createHmac("sha256", "pw").update(input).digest("hex"),
                   createHmac("sha256", "pw").update(expected).digest("hex"));
}

export function makeSession() {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return { value: `${exp}.${sign(String(exp))}`, maxAge: TTL_SECONDS };
}

export function verifySession(value: string | undefined) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(exp));
}

/** Call at the top of every admin page and every admin server action. */
export async function requireAdmin() {
  const ok = verifySession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!ok) throw new Error("unauthorized");
}

export async function isAdmin() {
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value);
}
