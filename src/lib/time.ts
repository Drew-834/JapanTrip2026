/** Japan Standard Time offset (no DST). */
const JST_MS = 9 * 60 * 60 * 1000;

/** Minutes from midnight JST for default hotel check-in (15:00). */
export const HOTEL_CHECK_IN_MIN = 15 * 60;
/** Minutes from midnight JST for default hotel check-out (10:00, next day). */
export const HOTEL_CHECK_OUT_MIN = 10 * 60;

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 24;
export const SNAP_MINUTES = 15;

export function toTokyoParts(d: Date): {
  y: number;
  m: number;
  day: number;
  hour: number;
  minute: number;
} {
  const t = d.getTime() + JST_MS;
  const x = new Date(t);
  return {
    y: x.getUTCFullYear(),
    m: x.getUTCMonth() + 1,
    day: x.getUTCDate(),
    hour: x.getUTCHours(),
    minute: x.getUTCMinutes(),
  };
}

/** Wall clock in JST for a UTC instant. */
export function toTokyoDate(d: Date): Date {
  const p = toTokyoParts(d);
  return new Date(Date.UTC(p.y, p.m - 1, p.day, p.hour, p.minute, 0, 0));
}

/** Interpret calendar y-m-d and hour/minute as JST wall time → UTC Date. */
export function jstDateTimeToUtc(
  year: number,
  month1: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, month1 - 1, day, hour - 9, minute, 0, 0));
}

export function formatJstDay(d: Date): string {
  const p = toTokyoParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function formatJstTime(d: Date): string {
  const p = toTokyoParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

const ISO_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Validate `YYYY-MM-DD` and that y/m/d form a real calendar day in UTC. */
export function normalizeIsoDateString(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_YMD.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const t = Date.UTC(y, m - 1, d);
  if (Number.isNaN(t)) return null;
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return value;
}

/** Normalize Firestore/string/Timestamp-shaped values to a safe trip anchor date. */
export function tripStartDateFromDoc(value: unknown): string {
  if (value != null && typeof value === "object" && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") {
      const d = fn();
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        const s = formatJstDay(d);
        return normalizeIsoDateString(s) ?? defaultTripStartDate();
      }
    }
  }
  if (typeof value === "string") {
    return normalizeIsoDateString(value) ?? defaultTripStartDate();
  }
  return defaultTripStartDate();
}

/** Pure calendar dates starting at tripStartDate (YYYY-MM-DD), length numDays. */
export function tripDayStrings(tripStartDate: string, numDays: number): string[] {
  const start =
    normalizeIsoDateString(tripStartDate) ?? defaultTripStartDate();
  const n = Number.isFinite(numDays) ? Math.max(1, Math.min(60, Math.floor(numDays))) : 21;
  const [y0, m0, d0] = start.split("-").map(Number);
  const out: string[] = [];
  let cur = new Date(Date.UTC(y0, m0 - 1, d0));
  for (let i = 0; i < n; i++) {
    out.push(
      `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}-${String(cur.getUTCDate()).padStart(2, "0")}`,
    );
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1));
  }
  return out;
}

export function safeNumTripDays(numDays: number): number {
  if (!Number.isFinite(numDays)) return 21;
  return Math.max(3, Math.min(45, Math.floor(numDays)));
}

export function minutesSinceDayStartJst(d: Date, dayStr: string): number {
  const parts = toTokyoParts(d);
  const key = `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  if (key !== dayStr) return -1;
  const startMin = DAY_START_HOUR * 60;
  const endMin = DAY_END_HOUR * 60;
  const m = parts.hour * 60 + parts.minute;
  return Math.max(0, Math.min(endMin - startMin, m - startMin));
}

export function snapMinutes(m: number): number {
  return Math.round(m / SNAP_MINUTES) * SNAP_MINUTES;
}

export function dayStartUtc(dayStr: string): Date {
  const [y, m, d] = dayStr.split("-").map(Number);
  return jstDateTimeToUtc(y, m, d, DAY_START_HOUR, 0);
}

export function dayEndUtc(dayStr: string): Date {
  const [y, m, d] = dayStr.split("-").map(Number);
  return jstDateTimeToUtc(y, m, d, DAY_END_HOUR, 0);
}

export function utcFromDayAndMinutes(dayStr: string, minutesFromGridStart: number): Date {
  const [y, m, d] = dayStr.split("-").map(Number);
  const total = DAY_START_HOUR * 60 + minutesFromGridStart;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return jstDateTimeToUtc(y, m, d, hh, mm);
}

export function blockSegmentsForDay(
  start: Date,
  end: Date,
  dayStr: string,
): { fromMin: number; toMin: number } | null {
  const d0 = dayStartUtc(dayStr);
  const d1 = dayEndUtc(dayStr);
  const s = Math.max(start.getTime(), d0.getTime());
  const e = Math.min(end.getTime(), d1.getTime());
  if (e <= s) return null;
  const fromMin = Math.floor((s - d0.getTime()) / 60_000);
  const toMin = Math.ceil((e - d0.getTime()) / 60_000);
  const cap = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  return {
    fromMin: Math.max(0, fromMin),
    toMin: Math.min(cap, toMin),
  };
}

export function defaultTripStartDate(): string {
  return formatJstDay(new Date());
}
