import type { PriceRule } from "@/lib/catalog/publication";
import { formatNumber } from "@/lib/money";
export const priceText = (amount: number | null) => amount === null ? "შეთანხმებით" : formatNumber(amount) + " ₾";
export const ruleText = (rule: PriceRule | null | undefined) =>
  rule ? "+" + formatNumber(rule.amount / 100) + (rule.kind === "fixed" ? " ₾" : "%") : "დანამატის გარეშე";
export const dateText = (date: Date) => new Intl.DateTimeFormat("ka-GE", {
  dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tbilisi",
}).format(date);
