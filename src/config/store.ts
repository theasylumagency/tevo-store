/**
 * Per-storefront configuration. One core serves several storefronts (standard, rodo.ge, agro-trade.ge…);
 * everything that differs between them lives here, never in components.
 */
export type PaymentMethod = "card" | "installment" | "cash";
export type DeliveryMethod = "pickup" | "delivery";

/** Seller details shown on legal pages and in messages. null = not filled in yet (shown as a placeholder). */
export interface LegalEntity {
  name: string | null;           // e.g. შპს „…“
  idCode: string | null;         // საიდენტიფიკაციო კოდი
  legalAddress: string | null;
  director: string | null;
}

export interface StoreContact {
  phone: string | null;
  email: string | null;
  hours: string | null;
  pickupAddress: string | null;
  serviceAddress: string | null; // warranty / service centre
}

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
  contact: StoreContact;
  legal: LegalEntity;
  /** version of the legal texts; stored on every order together with the moment of consent */
  termsVersion: string;
  /** false = texts are a draft awaiting a lawyer's review (a notice is shown on the pages) */
  legalReviewed: boolean;
  showReview: boolean;
}

type Base = Omit<StoreConfig, "showReview">;

const STORES: Record<string, Base> = {
  standard: {
    id: "standard", name: "მაღაზია", shortName: "მაღაზია", locale: "ka", currency: "GEL", phone: null,
    orderPrefix: "S", paymentMethods: ["card", "installment", "cash"], deliveryMethods: ["delivery", "pickup"],
    deliveryFee: null, maxQuantityPerLine: 20,
    contact: { phone: null, email: null, hours: null, pickupAddress: null, serviceAddress: null },
    legal: { name: null, idCode: null, legalAddress: null, director: null },
    termsVersion: "2026-11-25", legalReviewed: false,
  },
  rodo: {
    id: "rodo", name: "Rodo", shortName: "Rodo", locale: "ka", currency: "GEL", phone: null,
    orderPrefix: "R", paymentMethods: ["card", "installment", "cash"], deliveryMethods: ["delivery", "pickup"],
    deliveryFee: null, maxQuantityPerLine: 20,
    contact: { phone: null, email: null, hours: null, pickupAddress: null, serviceAddress: null },
    legal: { name: null, idCode: null, legalAddress: null, director: null },
    termsVersion: "2026-11-25", legalReviewed: false,
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
