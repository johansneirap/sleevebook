export function clampSpreadIndex(raw: string | undefined, max: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(Math.max(parsed, 0), max);
}
