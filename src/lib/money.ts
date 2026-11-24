/** Money helpers. Storage and arithmetic in integer tetri; display in ₾. */
export const toTetri = (gel: number) => Math.round(gel * 100);
export const fromTetri = (t: number) => t / 100;

/** Same output on server and in every browser (Intl grouping for "ka" differs between ICU builds). */
export function formatNumber(v: number) {
  const neg = v < 0;
  const [int, frac] = Math.abs(v).toFixed(2).split(".");
  const grouped = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : int;
  return `${neg ? "-" : ""}${grouped}${frac === "00" ? "" : "," + frac}`;
}

export const formatTetri = (t: number | null | undefined) => (t === null || t === undefined ? null : `${formatNumber(t / 100)} ₾`);
