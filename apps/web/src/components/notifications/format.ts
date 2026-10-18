// Pure helpers for the inbox. Safe to import from server and client code.

const KIND_LABELS: Record<string, string> = {
  precio: "Precio",
  "set-nuevo": "Set nuevo",
  intercambio: "Intercambio",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? "Aviso";
}

const RELATIVE = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** "hace 5 minutos", "ayer", "ahora": relative to `now`, in Spanish. */
export function relativeTime(date: Date, now: Date): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return RELATIVE.format(Math.round(seconds / size), unit);
    }
  }
  return RELATIVE.format(0, "second");
}
