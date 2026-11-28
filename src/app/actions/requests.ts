"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStore } from "@/config/store";
import { requireAdmin } from "@/lib/auth/admin";
import { recordFailure, tooManyAttempts } from "@/lib/auth/rate-limit";
import { createPurchaseRequest, RequestError, updatePurchaseRequest, validRequestId } from "@/lib/requests/service";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requests/model";

export interface RequestFormState { error?: string }

export async function submitPurchaseRequest(_previous: RequestFormState, form: FormData): Promise<RequestFormState> {
  const h = await headers();
  const ip = (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").at(-1) ?? "local").trim();
  const key = "purchase-request:" + getStore().id + ":" + ip;
  if (tooManyAttempts(key, 8)) return { error: "მოთხოვნების რაოდენობის დროებითი ზღვარი მიღწეულია. მოგვიანებით სცადეთ." };
  recordFailure(key);
  const raw = String(form.get("items") ?? "");
  let items: unknown;
  if (raw.length > 10000) return { error: "არჩეული პროდუქტების რაოდენობა მეტისმეტად დიდია." };
  try { items = JSON.parse(raw); } catch { return { error: "არჩეული პროდუქტები ვერ წავიკითხეთ." }; }
  let result: Awaited<ReturnType<typeof createPurchaseRequest>>;
  try {
    result = await createPurchaseRequest({
      items, token: String(form.get("token") ?? ""), name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""), deliveryMethod: String(form.get("deliveryMethod") ?? ""),
      locality: String(form.get("locality") ?? ""), question: String(form.get("question") ?? ""),
    });
  } catch (e) {
    return { error: e instanceof RequestError ? e.message : "მოთხოვნა ვერ შევინახეთ. თქვენი არჩევანი შენარჩუნებულია — სცადეთ ხელახლა." };
  }
  redirect("/request/" + result.id + "?t=" + result.token);
}

export async function updateRequestAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!validRequestId(id)) redirect("/admin/requests");
  const revision = String(form.get("revision") ?? "");
  const status = String(form.get("status") ?? "") as RequestStatus;
  const result = /^\d+$/.test(revision) && REQUEST_STATUSES.includes(status)
    ? await updatePurchaseRequest(id, Number(revision), status, String(form.get("response") ?? ""))
    : "invalid";
  redirect("/admin/requests/" + id + "?result=" + result);
}
