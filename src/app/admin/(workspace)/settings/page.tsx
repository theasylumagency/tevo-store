import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { readSettingsForAdmin, settingsHistory } from "@/lib/settings";
import { allChats, botUsername, telegramConfigured, webhookStatus, webhookUrl } from "@/lib/telegram";
import { disconnectTelegramChatAction } from "@/app/actions/settings";
import { SettingsForm } from "./SettingsForm";
import { TelegramLink, TelegramTest, TelegramWebhook } from "./TelegramPanel";
import { t } from "@/i18n";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const dt = new Intl.DateTimeFormat("ka-GE", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tbilisi" });

async function Telegram() {
  if (!telegramConfigured()) return <p className="text-sm text-ink-2">{t("admin.tg.not_configured")}</p>;
  const [bot, hook, chats] = await Promise.all([botUsername(), webhookStatus(), allChats()]);
  if (!bot) return <p className="text-sm text-warn">{t("admin.tg.bot_unreachable")}</p>;
  const hooked = hook?.url === webhookUrl();
  return (
    <div className="space-y-4">
      <p className="text-sm">{t("admin.tg.bot", { bot })} · {" "}
        <span className={hooked ? "text-accent" : "text-warn"} data-testid="tg-webhook">{t(hooked ? "admin.tg.webhook.ok" : "admin.tg.webhook.missing")}</span>
        {hook?.last_error_message && <span className="block text-xs text-warn">{t("admin.tg.webhook.error", { e: hook.last_error_message })}</span>}
      </p>
      {!hooked && <TelegramWebhook />}
      <div>
        <h3 className="mb-2 text-sm font-semibold">{t("admin.tg.chats")}</h3>
        {chats.length === 0 ? <p className="text-sm text-ink-2">{t("admin.tg.no_chats")}</p> : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface text-sm" data-testid="tg-chats">
            {chats.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                <span className={c.active ? "" : "text-ink-2 line-through"}>{c.title}</span>
                <span className="text-xs text-ink-2">{c.kind} · {dt.format(c.linkedAt)}</span>
                {c.active ? (
                  <form action={disconnectTelegramChatAction} className="ml-auto">
                    <input type="hidden" name="chatId" value={c.chatId} />
                    <button className="text-xs text-warn underline">{t("admin.tg.disconnect")}</button>
                  </form>
                ) : <span className="ml-auto text-xs text-ink-2">{t("admin.tg.inactive")}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-4"><TelegramLink /><TelegramTest /></div>
    </div>
  );
}

async function Settings() {
  await connection();
  if (!(await isAdmin())) redirect("/admin/login?next=/admin/settings");
  const [{ settings, updatedAt }, history] = await Promise.all([readSettingsForAdmin(), settingsHistory(5)]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("admin.settings.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">{t("admin.settings.lead")}</p>
        <p className="mt-1 text-xs text-ink-2">{updatedAt ? t("admin.settings.updated", { at: dt.format(new Date(updatedAt)) }) : t("admin.settings.never")}</p>
      </div>
      <SettingsForm settings={settings} />
      <section id="telegram" className="space-y-3 rounded-card border border-line bg-surface p-4">
        <h2 className="font-semibold">{t("admin.tg.title")}</h2>
        <Telegram />
      </section>
      {history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-2">{t("admin.settings.history")}</summary>
          <ul className="mt-2 space-y-1 text-xs text-ink-2">
            {history.map((h) => {
              const d = h.data as { legal?: { name?: string | null }; contact?: { phone?: string | null } };
              return <li key={h.id}>{dt.format(h.changedAt)} — {d.legal?.name ?? "—"}, {d.contact?.phone ?? "—"}</li>;
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-line/40" />}><Settings /></Suspense>;
}
