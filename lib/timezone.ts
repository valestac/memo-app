import { parseReminder } from "./reminder-parser";

function wallParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

function wallDate(instant: Date, timeZone: string) {
  const p = wallParts(instant, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

function wallToInstant(wall: Date, timeZone: string) {
  const target = wall.getTime();
  let candidate = new Date(target);
  for (let i = 0; i < 2; i += 1) {
    const represented = wallDate(candidate, timeZone).getTime();
    candidate = new Date(candidate.getTime() + target - represented);
  }
  return candidate;
}

export function parseReminderInTimezone(text: string, timeZone: string, now = new Date()) {
  const parsed = parseReminder(text, wallDate(now, timeZone));
  if (!parsed) return null;
  return { ...parsed, dueAt: wallToInstant(parsed.dueAt, timeZone) };
}

export function formatInTimezone(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(value instanceof Date ? value : new Date(value));
}
