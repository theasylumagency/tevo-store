"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, checkPassword, makeSession, requireAdmin } from "@/lib/auth/admin";
import { addNote, changeStatus } from "@/lib/orders/service";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/status";

export async function loginAction(_prev: { error?: boolean }, form: FormData): Promise<{ error?: boolean }> {
  const next = String(form.get("next") ?? "/admin");
  if (!checkPassword(String(form.get("password") ?? ""))) return { error: true };
  const s = makeSession();
  (await cookies()).set(ADMIN_COOKIE, s.value, { httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production", maxAge: s.maxAge });
  redirect(next.startsWith("/admin") ? next : "/admin");
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
