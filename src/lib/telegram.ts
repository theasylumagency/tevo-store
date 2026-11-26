import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getStore } from "@/config/store";
import { siteUrl } from "@/lib/site";

/**
 * Staff notifications through a Telegram bot (one bot per store, created with @BotFather).
 * TELEGRAM_BOT_TOKEN        — from @BotFather
 * TELEGRAM_WEBHOOK_SECRET   — any random string (min. 16 chars); Telegram sends it back with every update
 * Staff connect themselves: admin → settings → "connect" link → Start in Telegram.
 */
const { telegramChats, telegramLinkCodes } = schema;

export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);
const apiBase = () => (process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "");

export interface TgResult<T = unknown> { ok: boolean; result?: T; description?: string; error_code?: number }

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<TgResult<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`${apiBase()}/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    return (await res.json()) as TgResult<T>;
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}

let botName: string | null = null;
export async function botUsername() {
  if (botName) return botName;
  const r = await tg<{ username: string }>("getMe");
  if (r.ok && r.result) botName = r.result.username;
  return botName;
}

export const escHtml = (s: string | null | undefined) => (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Telegram refuses buttons pointing to localhost / plain http, so the button is only added on the public site. */
export async function sendTelegram(chatId: string, html: string, link?: string | null) {
  const markup = link && /^https:\/\//.test(link) ? { inline_keyboard: [[{ text: "გახსნა ადმინში", url: link }]] } : undefined;
  return tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true },
    ...(markup ? { reply_markup: markup } : {}),
  });
}

// ── chats ──────────────────────────────────────────────

export async function activeChats() {
  const db = await getDb();
  return db.select().from(telegramChats)
    .where(and(eq(telegramChats.storeId, getStore().id), eq(telegramChats.active, true))).orderBy(asc(telegramChats.id));
}

export async function allChats() {
  const db = await getDb();
  return db.select().from(telegramChats).where(eq(telegramChats.storeId, getStore().id)).orderBy(asc(telegramChats.id));
}

export async function setChatActive(chatId: string, active: boolean) {
  const db = await getDb();
  await db.update(telegramChats).set({ active })
    .where(and(eq(telegramChats.storeId, getStore().id), eq(telegramChats.chatId, chatId)));
}

/** Connect link valid for 30 minutes, usable once. Works for a person and (startgroup) for a group. */
export async function createLinkCode() {
  const db = await getDb();
  const code = randomBytes(9).toString("base64url");     // 12 chars, Telegram allows [A-Za-z0-9_-] up to 64
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  await db.insert(telegramLinkCodes).values({ code, storeId: getStore().id, expiresAt });
  const bot = await botUsername();
  return {
    code, expiresAt, bot,
    person: bot ? `https://t.me/${bot}?start=${code}` : null,
    group: bot ? `https://t.me/${bot}?startgroup=${code}` : null,
  };
}

async function redeemCode(code: string) {
  const db = await getDb();
  const [row] = await db.update(telegramLinkCodes).set({ usedAt: new Date() })
    .where(and(eq(telegramLinkCodes.code, code), eq(telegramLinkCodes.storeId, getStore().id),
               isNull(telegramLinkCodes.usedAt), gt(telegramLinkCodes.expiresAt, new Date())))
    .returning();
  return Boolean(row);
}

// ── webhook ────────────────────────────────────────────

interface TgChat { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string }
interface TgUpdate {
  message?: { chat: TgChat; text?: string; from?: { first_name?: string; last_name?: string; username?: string } };
  my_chat_member?: { chat: TgChat; new_chat_member: { status: string } };
}

const chatTitle = (c: TgChat, from?: { first_name?: string; last_name?: string; username?: string }) =>
  c.title ?? ([c.first_name ?? from?.first_name, c.last_name ?? from?.last_name].filter(Boolean).join(" ") || c.username || String(c.id));

/** Handles /start <code>, /stop, and the bot being removed from a chat. Replies go straight back to the chat. */
export async function handleUpdate(u: TgUpdate) {
  const store = getStore();
  if (u.my_chat_member) {
    const st = u.my_chat_member.new_chat_member.status;
    if (st === "left" || st === "kicked") await setChatActive(String(u.my_chat_member.chat.id), false);
    return;
  }
  const m = u.message;
  if (!m?.text) return;
  const chatId = String(m.chat.id);
  const [cmd, arg] = m.text.trim().split(/\s+/, 2);
  const command = cmd.split("@")[0].toLowerCase();

  if (command === "/start" && arg) {
    if (!(await redeemCode(arg))) {
      await sendTelegram(chatId, "ეს ბმული ვადაგასულია ან უკვე გამოყენებულია. ადმინში შექმენით ახალი.");
      return;
    }
    const db = await getDb();
    await db.insert(telegramChats).values({ storeId: store.id, chatId, title: chatTitle(m.chat, m.from), kind: m.chat.type })
      .onConflictDoUpdate({ target: [telegramChats.storeId, telegramChats.chatId],
                            set: { active: true, title: chatTitle(m.chat, m.from), kind: m.chat.type, linkedAt: new Date() } });
    await sendTelegram(chatId, `✅ დაკავშირებულია: <b>${escHtml(store.name)}</b>.\nაქ მოვა ახალი შეკვეთები. გასათიშად დაწერეთ /stop`);
    return;
  }
  if (command === "/stop") {
    await setChatActive(chatId, false);
    await sendTelegram(chatId, "შეტყობინებები გამორთულია. ხელახლა ჩასართავად ადმინში შექმენით ახალი ბმული.");
    return;
  }
  if (m.chat.type === "private" && command.startsWith("/")) {
    await sendTelegram(chatId, `ეს არის <b>${escHtml(store.name)}</b>-ის შეკვეთების ბოტი. დასაკავშირებლად გამოიყენეთ ადმინში შექმნილი ბმული.`);
  }
}

// ── webhook registration (admin button) ───────────────

export const webhookUrl = () => `${siteUrl()}/api/telegram/webhook`;

export async function registerWebhook() {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (secret.length < 16) return { ok: false, description: "TELEGRAM_WEBHOOK_SECRET must be at least 16 characters" } as TgResult;
  return tg("setWebhook", { url: webhookUrl(), secret_token: secret, allowed_updates: ["message", "my_chat_member"], drop_pending_updates: true });
}

export async function webhookStatus() {
  const r = await tg<{ url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number }>("getWebhookInfo");
  return r.ok ? r.result ?? null : null;
}
