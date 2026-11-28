"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStore } from "@/config/store";
import { requireAdmin } from "@/lib/auth/admin";
import { recordFailure, tooManyAttempts } from "@/lib/auth/rate-limit";
import { createPurchaseRequest, RequestError, updatePurchaseRequest, validRequestId } from "@/lib/requests/service";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requests/model";
import { parseOfferMoney } from "@/lib/requests/offer-model";
import { issueOffer, withdrawOffer, decideOffer } from "@/lib/requests/offers";

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


export async function issueOfferAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!validRequestId(id)) redirect("/admin/requests");
  const revision = String(form.get("revision") ?? "");
  const prices = Object.fromEntries(Array.from(form.entries()).filter(([k]) => k.startsWith("price:"))
    .map(([k, value]) => [k.slice(6), parseOfferMoney(String(value))]));
  const result = /^\d+$/.test(revision) ? await issueOffer(id, Number(revision), {
    prices, deliveryMethod: String(form.get("deliveryMethod") ?? ""),
    region: String(form.get("region") ?? ""), city: String(form.get("city") ?? ""),
    address: String(form.get("address") ?? ""), fulfilment: String(form.get("fulfilment") ?? ""),
    deliveryFee: parseOfferMoney(String(form.get("deliveryFee") ?? ""), true),
    expiresHours: Number(form.get("expiresHours")), stockEvidence: String(form.get("stockEvidence") ?? ""),
    confirmed: form.get("confirmed") === "on",
  }) : "invalid";
  redirect("/admin/requests/" + id + "?offer=" + result);
}

export async function withdrawOfferAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!validRequestId(id)) redirect("/admin/requests");
  const revision = String(form.get("revision") ?? "");
  const result = /^\d+$/.test(revision) ? await withdrawOffer(id, Number(revision)) : "invalid";
  redirect("/admin/requests/" + id + "?offer=" + result);
}

export async function decideOfferAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const token = String(form.get("token") ?? "");
  if (!validRequestId(id) || !/^[A-Za-z0-9_-]{43}$/.test(token)) redirect("/request");
  const decision = String(form.get("decision") ?? "");
  const version = String(form.get("version") ?? "");
  const result = (decision === "accept" || decision === "reject" || decision === "clarify") && /^\d+$/.test(version)
    ? await decideOffer({ id, token, version: Number(version), decision, consent: form.get("terms") === "on",
      termsVersion: String(form.get("termsVersion") ?? ""), clarification: String(form.get("clarification") ?? "") })
    : { result: "invalid" as const, redirectUrl: undefined };
  if (result.redirectUrl) redirect(result.redirectUrl);
  redirect("/request/" + id + "?t=" + encodeURIComponent(token) + "&offer=" + result.result);
}
