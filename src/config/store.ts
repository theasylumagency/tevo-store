/**
 * Per-storefront configuration. One core serves several storefronts (standard, tevo.ge, agro-trade.ge…);
 * everything that differs between them lives here, never in components.
 */
export type PaymentMethod = "card" | "installment" | "cash";
export type DeliveryMethod = "pickup" | "delivery";

export interface StoreConfig {
  id: string;
  name: string;
  shortName: string;
  locale: "ka";
  currency: "GEL";
  phone: string | null;
  orderPrefix: string;
  paymentMethods: PaymentMethod[];
  deliveryMethods: DeliveryMethod[];
  /** fixed delivery fee in tetri; null = agreed by phone (heavy machinery, rural addresses) */
  deliveryFee: number | null;
  maxQuantityPerLine: number;
  showReview: boolean;
}

type Base = Omit<StoreConfig, "showReview">;

const STORES: Record<string, Base> = {
  standard: {
    id: "standard", name: "მაღაზია", shortName: "მაღაზია", locale: "ka", currency: "GEL", phone: null,
    orderPrefix: "S", paymentMethods: ["card", "installment", "cash"], deliveryMethods: ["delivery", "pickup"],
    deliveryFee: null, maxQuantityPerLine: 20,
  },
  tevo: {
    id: "tevo", name: "Tevo", shortName: "Tevo", locale: "ka", currency: "GEL", phone: null,
    orderPrefix: "T", paymentMethods: ["card", "installment", "cash"], deliveryMethods: ["delivery", "pickup"],
    deliveryFee: null, maxQuantityPerLine: 20,
  },
};

export function getStore(): StoreConfig {
  const base = STORES[process.env.STORE_ID ?? "standard"] ?? STORES.standard;
  return { ...base, showReview: process.env.REVIEW_MODE === "1" };
}

export const GEORGIA_REGIONS = [
  "თბილისი", "აჭარა", "გურია", "იმერეთი", "კახეთი", "მცხეთა-მთიანეთი", "რაჭა-ლეჩხუმი და ქვემო სვანეთი",
  "სამეგრელო-ზემო სვანეთი", "სამცხე-ჯავახეთი", "ქვემო ქართლი", "შიდა ქართლი",
] as const;
