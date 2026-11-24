"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/admin";
import { t } from "@/i18n";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<{ error?: boolean }, FormData>(loginAction, {});
  return (
    <form action={action} className="mx-auto mt-10 max-w-sm space-y-3 rounded-card border border-line bg-surface p-6">
      <h1 className="text-xl font-bold">{t("admin.title")}</h1>
      <input type="hidden" name="next" value={next} />
      <label className="block"><span className="mb-1 block text-sm">{t("admin.password")}</span>
        <input name="password" type="password" autoComplete="current-password" autoFocus
               className="w-full rounded-card border border-line px-3 py-2" /></label>
      {state.error && <p className="text-sm text-warn" role="alert">{t("admin.login.error")}</p>}
      <button disabled={pending} className="w-full rounded-card bg-accent px-4 py-2 text-accent-ink">{t("admin.login")}</button>
    </form>
  );
}
