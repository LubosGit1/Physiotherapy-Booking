/** €55 for whole euros, €45.50 otherwise. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "45", "45.5" or "45,50" → cents. Returns null for anything else. */
export function parsePrice(value: string): number | null {
  const normalised = value.trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(normalised)) return null;
  return Math.round(Number(normalised) * 100);
}
