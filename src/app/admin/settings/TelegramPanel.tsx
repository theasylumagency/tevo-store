"use client";

import { useActionState } from "react";
import { createTelegramLinkAction, registerWebhookAction, testTelegramAction,
         type LinkState, type TgActionState } from "@/app/actions/settings";
import { t } from "@/i18n";

const btn = "rounded-card border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50";

export function TelegramLink() {
  const [s, action, pending] = useActionState<LinkState>(createTelegramLinkAction, {});
  return (
    <div className="space-y-2">
      <form action={action}><button disabled={pending} className={btn}>{t("admin.tg.link.button")}</button></form>
      {s.error === "bot_unreachable" && <p className="text-sm text-warn">{t("admin.tg.bot_unreachable")}</p>}
      {s.person && (
        <div className="space-y-1 rounded-card bg-bg p-3 text-sm" data-testid="tg-link">
          <p>{t("admin.tg.link.person")}: <a href={s.person} target="_blank" rel="noreferrer" className="break-all text-accent underline">{s.person}</a></p>
          <p>{t("admin.tg.link.group")}: <a href={s.group!} target="_blank" rel="noreferrer" className="break-all text-accent underline">{s.group}</a></p>
          <p className="text-xs text-ink-2">{t("admin.tg.link.expires")}</p>
        </div>
      )}
    </div>
  );
}

export function TelegramTest() {
  const [s, action, pending] = useActionState<TgActionState>(testTelegramAction, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <button disabled={pending} className={btn}>{t("admin.tg.test")}</button>
      {s.ok && <span className="text-sm text-accent" role="status">{t("admin.tg.test.ok", { n: s.message ?? "" })}</span>}
      {s.ok === false && <span className="text-sm text-warn" role="alert">{s.message === "no_chats" ? t("admin.tg.test.no_chats") : s.message}</span>}
    </form>
  );
}

export function TelegramWebhook() {
  const [s, action, pending] = useActionState<TgActionState>(registerWebhookAction, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <button disabled={pending} className={btn}>{t("admin.tg.webhook.button")}</button>
      {s.ok && <span className="text-sm text-accent" role="status">{t("admin.tg.webhook.ok")}</span>}
      {s.ok === false && <span className="text-sm text-warn" role="alert">{s.message}</span>}
    </form>
  );
}
