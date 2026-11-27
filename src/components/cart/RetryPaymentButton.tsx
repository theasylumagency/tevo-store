"use client";

import { useFormStatus } from "react-dom";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";

export function RetryPaymentButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className={ui.primaryAction} disabled={pending} data-testid="retry-payment" aria-live="polite">
    {pending ? "გადახდაზე გადავდივართ…" : t("order.pay_again")}
  </button>;
}
