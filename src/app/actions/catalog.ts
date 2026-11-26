"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireCatalogRole } from "@/lib/auth/admin";
import { changeProduct, importCatalog, setGlobalRule } from "@/lib/catalog/editorial";
import { CatalogInputError, parseRule, type ProductEdits } from "@/lib/catalog/publication";

const input = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const key = (form: FormData) => ({
  id: z.string().regex(/^at-\d+$/).parse(input(form, "id")), token: input(form, "token"),
});
const ruleFromForm = (form: FormData) => parseRule(input(form, "kind"), input(form, "amount"));
const editsSchema = z.object({
  name: z.string().min(1).max(240).optional(), subtitle: z.string().max(500).nullable().optional(),
  description: z.string().max(32000).optional(), features: z.array(z.string().max(500)).max(60).optional(),
});

export async function saveDraftAction(_state: string | null, form: FormData): Promise<string | null> {
  const role = await requireCatalogRole();
  const { id, token } = key(form);
  try {
    const edits: ProductEdits = {};
    if (form.has("override-name")) edits.name = input(form, "name");
    if (form.has("override-subtitle")) edits.subtitle = input(form, "subtitle") || null;
    if (form.has("override-description")) edits.description = input(form, "description");
    if (form.has("override-features")) edits.features = input(form, "features").split(/\r?\n/).map(f => f.trim()).filter(Boolean);
    if (!editsSchema.safeParse(edits).success) throw new CatalogInputError("შეამოწმე ტექსტის სიგრძე და სათაური.");
    const rule = ruleFromForm(form);
    if (rule) edits.rule = rule;
    await changeProduct(id, token, { type: "save", edits }, role);
  } catch (e) {
    if (e instanceof CatalogInputError) return e.message;
    throw e;
  }
  revalidatePath("/admin/catalog", "layout");
  redirect("/admin/catalog/" + id + (form.get("intent") === "preview" ? "/preview" : "?saved=1"));
}

export async function publishAction(form: FormData) {
  await requireAdmin();
  const { id, token } = key(form);
  try {
    await changeProduct(id, token, { type: "publish" }, "admin");
  } catch (e) {
    if (e instanceof CatalogInputError) redirect("/admin/catalog/" + id + "?error=" + encodeURIComponent(e.message));
    throw e;
  }
  updateTag("catalog");
  revalidatePath("/admin/catalog", "layout");
  redirect("/admin/catalog/" + id + "?published=1");
}

export async function restoreAction(form: FormData) {
  const actor = await requireCatalogRole();
  const { id, token } = key(form);
  try {
    await changeProduct(id, token, { type: "restore", id: Number(input(form, "version")) }, actor);
  } catch (e) {
    if (e instanceof CatalogInputError) redirect("/admin/catalog/" + id + "?error=" + encodeURIComponent(e.message));
    throw e;
  }
  revalidatePath("/admin/catalog", "layout");
  redirect("/admin/catalog/" + id + "/preview");
}

export async function globalPriceAction(form: FormData) {
  await requireAdmin();
  try {
    await setGlobalRule(ruleFromForm(form), input(form, "publicationVersion"), "admin");
  } catch (e) {
    if (e instanceof CatalogInputError) redirect("/admin/pricing?error=" + encodeURIComponent(e.message));
    throw e;
  }
  updateTag("catalog");
  revalidatePath("/admin/pricing");
  redirect("/admin/pricing?updated=1");
}

export async function importAction() {
  await requireAdmin();
  try {
    await importCatalog();
  } catch (e) {
    console.error("Store catalog import failed", e);
    const message = e instanceof CatalogInputError ? e.message : "წყაროს წაკითხვა ვერ მოხერხდა. ბოლო გამოქვეყნებული ვერსია შენარჩუნებულია.";
    redirect("/admin/catalog?error=" + encodeURIComponent(message));
  }
  updateTag("catalog");
  redirect("/admin/catalog?imported=1");
}
