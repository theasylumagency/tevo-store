import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@/config/store";
import { redirect } from "next/navigation";
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

export type CatalogRole = "admin" | "editor";

export function loginRole(input: string): CatalogRole | null {
  function matches(expected: string | undefined) {
    return !!expected && expected !== "change-me" && safeEqual(
      createHmac("sha256", "pw").update(input).digest("hex"),
      createHmac("sha256", "pw").update(expected).digest("hex"));
  }
  if (matches(process.env.ADMIN_PASSWORD)) return "admin";
  if (matches(process.env.CATALOG_EDITOR_PASSWORD)) return "editor";
  return null;
}

export function makeSession(role: CatalogRole) {
  const payload = [getStore().id, role, Math.floor(Date.now() / 1000) + TTL_SECONDS].join(".");
  return { value: payload + "." + sign(payload), maxAge: TTL_SECONDS };
}

export async function catalogRole(): Promise<CatalogRole | null> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!value) return null;
  const [store, role, exp, sig, ...extra] = value.split(".");
  if (extra.length || !sig || store !== getStore().id || (role !== "admin" && role !== "editor") ||
      !/^\d+$/.test(exp) || Number(exp) <= Date.now() / 1000) return null;
  return safeEqual(sig, sign([store, role, exp].join("."))) ? role : null;
}

export async function requireCatalogRole() {
  const role = await catalogRole();
  if (!role) redirect("/admin/login?next=/admin/catalog");
  return role;
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("unauthorized");
}

export async function isAdmin() {
  return (await catalogRole()) === "admin";
}
