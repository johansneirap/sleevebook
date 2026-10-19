import { type Database, scanLog } from "@sleevebook/db";
import { and, count, eq, gte } from "drizzle-orm";

/** The daily scan limit resets at local midnight here (Chile). */
export const SCAN_TIME_ZONE = "America/Santiago";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Milliseconds that `timeZone` is ahead of UTC at `instant`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant of local midnight (start of the calendar day) of `now` in `timeZone`. */
export function startOfLocalDay(now: Date, timeZone: string = SCAN_TIME_ZONE): Date {
  const p = zonedParts(now, timeZone);
  const asUtcMidnight = Date.UTC(p.year, p.month - 1, p.day);
  // Two passes so the offset is right on a DST change day.
  const first = asUtcMidnight - zoneOffsetMs(new Date(asUtcMidnight), timeZone);
  return new Date(asUtcMidnight - zoneOffsetMs(new Date(first), timeZone));
}

/** Scan rows (any status) the user created since `since`. */
export async function countScansSince(db: Database, userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(scanLog)
    .where(and(eq(scanLog.userId, userId), gte(scanLog.createdAt, since)));
  return Number(row?.value ?? 0);
}

/** Scans the user has already made today (local Chile day). Count before calling the API. */
export function countScansToday(
  db: Database,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  return countScansSince(db, userId, startOfLocalDay(now));
}
