export function normalizeText(value: string) {
  return value.normalize("NFC").trim();
}

export function normalizeInstagramHandle(value: string) {
  return value.normalize("NFC").trim().replace(/^@/, "").toLowerCase();
}

export function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value ?? "");
  return normalized.length > 0 ? normalized : null;
}

export function normalizeTagList(values: string[]) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)));
}

export function isIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
