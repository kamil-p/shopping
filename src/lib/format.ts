/** Polish plural selection: one / few (2–4) / many. */
export function pluralPl(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export const produkty = (n: number) =>
  pluralPl(n, "produkt", "produkty", "produktów");

export function formatDate(date: Date): string {
  return date.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
