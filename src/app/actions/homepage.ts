"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { isAdmin, requireAdmin } from "@/lib/auth/admin";
import { changeHome, HomeConflictError } from "@/lib/homepage/service";
import { saveHomePhoto } from "@/lib/homepage/media";
import { HomeInputError, parseHome } from "@/lib/homepage/validation";

const base = "/admin/homepage";
function refreshPublic() { updateTag("homepage"); revalidatePath("/"); }
function refresh(publication: boolean) {
  revalidatePath(base, "layout");
  if (publication) refreshPublic();
}
function documentFrom(input: unknown) {
  if (JSON.stringify(input).length > 120_000) throw new HomeInputError("მონახაზი დასაშვებ ზომას აჭარბებს.");
  return parseHome(input);
}

export async function saveHomeDraftAction(input: { revision: number; document: unknown }): Promise<{
  revision?: number; savedAt?: string; error?: string; conflict?: boolean;
}> {
  if (!(await isAdmin())) return { error: "ავტორიზაციის ვადა ამოიწურა. მონახაზის შესანახად ხელახლა შედი სისტემაში." };
  try {
    const { revision, publicationChanged } = await changeHome(input.revision, { kind: "save", document: documentFrom(input.document) });
    // Keep the editor mounted. A completed scheduled release can still need a public cache refresh.
    if (publicationChanged) refreshPublic();
    return { revision, savedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof HomeInputError) return { error: err.message, conflict: err instanceof HomeConflictError };
    console.error("Homepage draft save failed", err instanceof Error ? err.name : "unknown");
    return { error: "მონახაზი ვერ შეინახა. ცვლილებები ამ ფანჯარაში დარჩა — სცადე ხელახლა." };
  }
}

export async function saveHomeAction(_previous: string | null, form: FormData): Promise<string | null> {
  await requireAdmin();
  let publicationChanged = false;
  try {
    const raw = String(form.get("document") ?? "");
    if (raw.length > 120_000) throw new HomeInputError("მონახაზი დასაშვებ ზომას აჭარბებს.");
    ({ publicationChanged } = await changeHome(Number(form.get("revision")), { kind: "save", document: documentFrom(JSON.parse(raw)) }));
  } catch (err) {
    if (err instanceof HomeInputError) return err.message;
    if (err instanceof SyntaxError) return "მონახაზის წაკითხვა ვერ მოხერხდა.";
    throw err;
  }
  refresh(publicationChanged);
  redirect(form.get("intent") === "preview" ? base + "/preview" : base + "?saved=1");
}

export async function uploadHomePhotoAction(form: FormData): Promise<{ file?: string; error?: string }> {
  if (!(await isAdmin())) return { error: "ფოტოს ასატვირთად საჭიროა ადმინისტრატორის ავტორიზაცია." };
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "აირჩიე ფოტო." };
  try {
    const stored = await saveHomePhoto(file);
    updateTag("media");
    return { file: stored };
  } catch (err) {
    if (err instanceof HomeInputError) return { error: err.message };
    console.error("Homepage photo upload failed", err instanceof Error ? err.name : "unknown");
    return { error: "ფოტო ვერ შეინახა. სცადე ხელახლა ან აირჩიე არსებული ფოტო." };
  }
}

export async function releaseHomeAction(form: FormData) {
  await requireAdmin();
  const kind = form.get("intent");
  if (kind !== "publish" && kind !== "schedule" && kind !== "cancel") throw new Error("Unknown homepage action");
  let revision: number;
  try {
    const change = kind === "schedule" ? { kind, start: String(form.get("start") ?? ""), end: String(form.get("end") ?? "") } as const : { kind } as const;
    ({ revision } = await changeHome(Number(form.get("revision")), change));
  } catch (err) {
    if (!(err instanceof HomeInputError)) throw err;
    redirect((kind === "cancel" ? base : base + "/preview") + "?error=" + encodeURIComponent(err.message));
  }
  refresh(true);
  redirect(base + "?done=" + kind + "&revision=" + revision);
}

export async function restoreHomeAction(form: FormData) {
  await requireAdmin();
  let revision: number;
  let publicationChanged = false;
  try {
    ({ revision, publicationChanged } = await changeHome(Number(form.get("revision")), { kind: "restore", id: Number(form.get("id")) }));
  } catch (err) {
    if (!(err instanceof HomeInputError)) throw err;
    redirect(base + "/history?error=" + encodeURIComponent(err.message));
  }
  refresh(publicationChanged);
  redirect(base + "?done=restore&revision=" + revision);
}
