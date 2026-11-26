"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { saveSettings, settingsSchema } from "@/lib/settings";
import { activeChats, createLinkCode, registerWebhook, sendTelegram, setChatActive, telegramConfigured } from "@/lib/telegram";
import { getStore } from "@/config/store";

export interface SettingsState { ok?: boolean; errors?: Record<string, string>; savedAt?: string }

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function saveSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  await requireAdmin();
  const emails = str(form, "staff.emails").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const parsed = settingsSchema.safeParse({
    legal: { name: str(form, "legal.name"), idCode: str(form, "legal.idCode"), legalAddress: str(form, "legal.legalAddress"),
             director: str(form, "legal.director") },
    contact: { phone: str(form, "contact.phone"), email: str(form, "contact.email"), hours: str(form, "contact.hours"),
               pickupAddress: str(form, "contact.pickupAddress"), serviceAddress: str(form, "contact.serviceAddress") },
    staff: { emails, telegram: form.get("staff.telegram") === "on" },
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const field = i.path[0] === "staff" ? "staff.emails" : i.path.slice(0, 2).join(".");
      errors[field] = field;
    }
    return { errors };
  }
  await saveSettings(parsed.data);
  updateTag("settings");          // footer, legal pages and messages show the new details right away
  return { ok: true, savedAt: new Date().toISOString() };
}

export interface LinkState { person?: string | null; group?: string | null; expiresAt?: string; error?: string }

export async function createTelegramLinkAction(): Promise<LinkState> {
  await requireAdmin();
  if (!telegramConfigured()) return { error: "not_configured" };
  const l = await createLinkCode();
  if (!l.bot) return { error: "bot_unreachable" };
  return { person: l.person, group: l.group, expiresAt: l.expiresAt.toISOString() };
}

export async function disconnectTelegramChatAction(form: FormData) {
  await requireAdmin();
  const chatId = str(form, "chatId");
  await setChatActive(chatId, false);
  await sendTelegram(chatId, "ამ ჩატში შეკვეთების შეტყობინებები გამოირთო ადმინიდან.");
  redirect("/admin/settings#telegram");
}

export interface TgActionState { ok?: boolean; message?: string }

export async function testTelegramAction(): Promise<TgActionState> {
  await requireAdmin();
  const chats = await activeChats();
  if (!chats.length) return { ok: false, message: "no_chats" };
  const results = await Promise.all(chats.map((c) => sendTelegram(c.chatId, `🔔 სატესტო შეტყობინება — <b>${getStore().name}</b>. ყველაფერი მუშაობს.`)));
  const failed = results.filter((r) => !r.ok);
  return failed.length ? { ok: false, message: failed.map((r) => r.description).join("; ") } : { ok: true, message: String(chats.length) };
}

export async function registerWebhookAction(): Promise<TgActionState> {
  await requireAdmin();
  const r = await registerWebhook();
  return { ok: r.ok, message: r.ok ? undefined : r.description };
}
