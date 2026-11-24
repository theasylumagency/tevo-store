/** Georgian numbers: 9 digits after an optional +995 / 995 / 0 prefix → "+995XXXXXXXXX", else null. */
export function normalizePhone(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("995")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^[3-7]\d{8}$/.test(d) ? `+995${d}` : null;
}

export function formatPhone(p: string) {
  const d = p.replace(/^\+995/, "");
  return d.length === 9 ? `+995 ${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : p;
}
