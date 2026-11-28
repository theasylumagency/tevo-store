"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireCatalogRole } from "@/lib/auth/admin";
import { approveVoice, createRun, publishApproved, reviewItem } from "@/lib/voice/service";
import { VoiceError } from "@/lib/voice/model";

const base = "/admin/voice";
const input = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function uuid(f: FormData) { return z.uuid().parse(input(f, "run")); }
function revision(f: FormData) {
  const raw = input(f, "revision");
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new VoiceError("ვერსია არასწორია.");
  return Number(raw);
}
function failure(err: unknown, path: string): never {
  if (!(err instanceof VoiceError)) throw err;
  redirect(path + "?error=" + encodeURIComponent(err.message));
}
export async function startVoiceAction(f: FormData) {
  await requireAdmin();
  const id = uuid(f);
  try {
    const scope = input(f, "scope");
    if (scope !== "audition" && scope !== "catalog") throw new VoiceError("აირჩიე ხმის გამოცდა ან კატალოგის მომზადება.");
    const profile = scope === "audition" ? { tone: input(f, "tone"), avoid: input(f, "avoid"), example: input(f, "example"), audience: input(f, "audience") } : undefined;
    if (profile && (!profile.tone || Object.values(profile).some(s => s.length > 1500))) {
      throw new VoiceError("მიუთითე ტონი. თითო ველში დაშვებულია 1500 სიმბოლო.");
    }
    await createRun(id, scope, f.getAll("product").map(String), revision(f), input(f, "basis") || null, profile, f.has("notify"), input(f, "plan"));
  } catch (e) { failure(e, base); }
  revalidatePath(base);
  redirect(base + "/" + id);
}

export async function approveVoiceAction(f: FormData) {
  await requireAdmin();
  const id = uuid(f);
  try { await approveVoice(id, f.has("ack")); }
  catch (e) { failure(e, base + "/" + id); }
  revalidatePath(base);
  redirect(base + "?approved=1");
}
export async function reviewVoiceAction(_state: string | null, f: FormData): Promise<string | null> {
  const role = await requireCatalogRole();
  const id = uuid(f), path = base + "/" + id;
  const intent = input(f, "intent");
  try {
    if (intent !== "save" && intent !== "approve" && intent !== "reject") throw new VoiceError("ქმედება არასწორია.");
    await reviewItem(id, Number(input(f, "item")), revision(f), intent, input(f, "description"), f.has("ack"), role);
  } catch (e) {
    if (e instanceof VoiceError) return e.message;
    throw e;
  }
  revalidatePath(path);
  redirect(path + "?page=" + (Number(input(f, "page")) || 1) + "#item-" + Number(input(f, "item")));
}
export async function retryVoiceAction(f: FormData) {
  await requireAdmin();
  const id = uuid(f), path = base + "/" + id;
  try {
    await reviewItem(id, Number(input(f, "item")), revision(f), "retry", "", false, "admin");
  } catch (e) { failure(e, path); }
  revalidatePath(path);
  redirect(path);
}
export async function publishVoiceAction(f: FormData) {
  await requireAdmin();
  const id = uuid(f), path = base + "/" + id;
  let result;
  try {
    const expected = new Map<number, number>();
    for (const entry of f.getAll("version")) {
      if (!/^\d+:\d+$/.test(String(entry))) throw new VoiceError("ჩანაწერის ვერსია არასწორია.");
      const [key, version] = String(entry).split(":").map(Number);
      expected.set(key, version);
    }
    result = await publishApproved(id, expected, f.has("catalogReview"));
  } catch (e) { failure(e, path); }
  if (result.count) updateTag("catalog");
  revalidatePath("/admin/catalog", "layout");
  revalidatePath(path);
  redirect(path + "?published=" + result.count + "&stale=" + result.stale);
}
