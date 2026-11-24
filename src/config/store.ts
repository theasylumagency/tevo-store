/**
 * Per-storefront configuration. One core serves several storefronts (standard, tevo.ge, agro-trade.ge…);
 * everything that differs between them lives here, never in components.
 */
export interface StoreConfig {
  id: string;
  name: string;
  shortName: string;
  locale: "ka";
  currency: "GEL";
  phone: string | null;
  showReview: boolean;
}

const STORES: Record<string, Omit<StoreConfig, "showReview">> = {
  standard: { id: "standard", name: "მაღაზია", shortName: "მაღაზია", locale: "ka", currency: "GEL", phone: null },
  tevo: { id: "tevo", name: "Tevo", shortName: "Tevo", locale: "ka", currency: "GEL", phone: null },
};

export function getStore(): StoreConfig {
  const base = STORES[process.env.STORE_ID ?? "standard"] ?? STORES.standard;
  return { ...base, showReview: process.env.REVIEW_MODE === "1" };
}
