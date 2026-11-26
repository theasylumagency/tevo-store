"use server";

import { cookies, headers } from "next/headers";
import { clearFailures, recordFailure, tooManyAttempts } from "@/lib/auth/rate-limit";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, loginRole, makeSession, requireAdmin } from "@/lib/auth/admin";
import { addNote, changeStatus } from "@/lib/orders/service";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/status";

export async function loginAction(_prev: { error?: boolean; locked?: boolean }, form: FormData): Promise<{ error?: boolean; locked?: boolean }> {
  const next = String(form.get("next") ?? "/admin");
  const h = await headers();
  // X-Real-IP is set by our reverse proxy (Caddy/nginx); the last X-Forwarded-For hop is the fallback —
  // the first one is client-controlled and would let an attacker dodge the limit.
  const ip = (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").at(-1) ?? "local").trim();
  if (tooManyAttempts(ip)) return { locked: true };
  const role = loginRole(String(form.get("password") ?? ""));
  if (!role) {
    recordFailure(ip);
    await new Promise((r) => setTimeout(r, 400));   // slow down guessing
    return { error: true };
  }
  clearFailures(ip);
  const s = makeSession(role);
  (await cookies()).set(ADMIN_COOKIE, s.value, { httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production", maxAge: s.maxAge });
  redirect(role === "editor" ? "/admin/catalog" : next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export async function changeStatusAction(form: FormData) {
  await requireAdmin();
  const number = String(form.get("number") ?? "");
  const to = String(form.get("to") ?? "") as OrderStatus;
  if (!ORDER_STATUSES.includes(to)) throw new Error("bad status");
  await changeStatus(number, to, String(form.get("note") ?? "").trim().slice(0, 2000) || null);
  redirect(`/admin/orders/${number}`);
}

export async function addNoteAction(form: FormData) {
  await requireAdmin();
  const number = String(form.get("number") ?? "");
  await addNote(number, String(form.get("note") ?? ""));
  redirect(`/admin/orders/${number}`);
}
