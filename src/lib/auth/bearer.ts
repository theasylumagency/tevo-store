import { timingSafeEqual } from "node:crypto";

/** Constant-time check of "Authorization: Bearer <token>" against an env secret (min. 16 chars). */
export function hasBearer(req: Request, envName: string) {
  const expected = process.env[envName] ?? "";
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got), b = Buffer.from(expected);
  return expected.length >= 16 && a.length === b.length && timingSafeEqual(a, b);
}
