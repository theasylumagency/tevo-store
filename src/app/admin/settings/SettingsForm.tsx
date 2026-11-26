"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsState } from "@/app/actions/settings";
import type { StoreSettings } from "@/lib/settings";
import { t, type MessageKey } from "@/i18n";

const LEGAL = ["name", "idCode", "legalAddress", "director"] as const;
const CONTACT = ["phone", "email", "hours", "pickupAddress", "serviceAddress"] as const;

function Field({ name, value, error, type = "text" }: { name: string; value: string | null; error?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm">{t(`admin.settings.${name}` as MessageKey)}</span>
      <input name={name} type={type} defaultValue={value ?? ""} aria-invalid={error || undefined}
             className={`w-full rounded-card border px-3 py-2 text-sm ${error ? "border-warn" : "border-line"}`} />
    </label>
  );
}

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  const err = state.errors ?? {};
  return (
    <form action={action} className="space-y-6" data-testid="settings-form">
      <fieldset className="space-y-3 rounded-card border border-line bg-surface p-4">
        <legend className="px-1 font-semibold">{t("admin.settings.legal")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {LEGAL.map((k) => <Field key={k} name={`legal.${k}`} value={settings.legal[k]} error={!!err[`legal.${k}`]} />)}
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-card border border-line bg-surface p-4">
        <legend className="px-1 font-semibold">{t("admin.settings.contact")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONTACT.map((k) => <Field key={k} name={`contact.${k}`} value={settings.contact[k]} error={!!err[`contact.${k}`]}
                                     type={k === "email" ? "email" : k === "phone" ? "tel" : "text"} />)}
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-card border border-line bg-surface p-4">
        <legend className="px-1 font-semibold">{t("admin.settings.staff")}</legend>
        <label className="block">
          <span className="mb-1 block text-sm">{t("admin.settings.staff.emails")}</span>
          <textarea name="staff.emails" rows={3} defaultValue={settings.staff.emails.join("\n")}
                    className={`w-full rounded-card border px-3 py-2 font-mono text-sm ${err["staff.emails"] ? "border-warn" : "border-line"}`} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="staff.telegram" defaultChecked={settings.staff.telegram} />
          {t("admin.settings.staff.telegram")}
        </label>
      </fieldset>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-card bg-accent px-5 py-2 text-accent-ink">{t("admin.save")}</button>
        {state.ok && <span className="text-sm text-accent" role="status">{t("admin.settings.saved")}</span>}
        {state.errors && <span className="text-sm text-warn" role="alert">{t("admin.settings.invalid")}</span>}
      </div>
    </form>
  );
}
