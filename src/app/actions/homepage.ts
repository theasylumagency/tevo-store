"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { changeHome } from "@/lib/homepage/service";
import { HomeInputError, parseHome } from "@/lib/homepage/validation";

const base = "/admin/homepage";
function refresh(publication: boolean) {
  revalidatePath(base, "layout");
  if (publication) { updateTag("homepage"); revalidatePath("/"); }
}
export async function saveHomeAction(_previous: string | null, form: FormData): Promise<string | null> {
  await requireAdmin();
  try {
    const raw = String(form.get("document") ?? "");
    if (raw.length > 24000) throw new HomeInputError("მონახაზი დასაშვებ ზომას აჭარბებს.");
    const document = parseHome(JSON.parse(raw));
    await changeHome(Number(form.get("revision")), { kind: "save", document });
  } catch (err) {
    if (err instanceof HomeInputError) return err.message;
    if (err instanceof SyntaxError) return "მონახაზის წაკითხვა ვერ მოხერხდა.";
    throw err;
  }
  refresh(false);
  redirect(form.get("intent") === "preview" ? base + "/preview" : base + "?saved=1");
}
export async function releaseHomeAction(form: FormData) {
  await requireAdmin();
  const kind = form.get("intent");
  if (kind !== "publish" && kind !== "schedule" && kind !== "cancel") throw new Error("Unknown homepage action");
  try {
    const change = kind === "schedule" ? { kind, start: String(form.get("start") ?? ""), end: String(form.get("end") ?? "") } as const : { kind } as const;
    await changeHome(Number(form.get("revision")), change);
  } catch (err) {
    if (!(err instanceof HomeInputError)) throw err;
    redirect((kind === "cancel" ? base : base + "/preview") + "?error=" + encodeURIComponent(err.message));
  }
  refresh(true);
  redirect(base + "?done=" + kind);
}
