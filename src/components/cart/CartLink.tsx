"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { t } from "@/i18n";

export function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" aria-label={ready && count > 0 ? `${t("cart.title")}, ${count} პროდუქტი` : t("cart.title")} className="relative flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent">
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" />
      </svg>
      <span className="hidden sm:inline">{t("cart.title")}</span>
      {ready && count > 0 && (
        <span data-testid="cart-count" className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-ink">{count}</span>
      )}
    </Link>
  );
}
