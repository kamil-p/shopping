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

/** "Niedziela, 31.05.2026" — weekday + full date, for list subtitles. */
export function formatListDate(date: Date): string {
  const formatted = date.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Display name for a list. Older lists were created as `${set} — DD.MM`; the
 * date now lives in the subtitle, so strip that legacy suffix to avoid showing
 * the date twice.
 */
export function listDisplayName(name: string): string {
  return name.replace(/\s+—\s+\d{2}\.\d{2}$/, "");
}
