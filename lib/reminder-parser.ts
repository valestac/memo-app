export type ParsedReminder = { title: string; dueAt: Date };

const weekdays: Record<string, number> = {
  sunday: 0, domenica: 0, monday: 1, lunedi: 1, lunedì: 1,
  tuesday: 2, martedi: 2, martedì: 2, wednesday: 3, mercoledi: 3, mercoledì: 3,
  thursday: 4, giovedi: 4, giovedì: 4, friday: 5, venerdi: 5, venerdì: 5,
  saturday: 6, sabato: 6,
};

const months: Record<string, number> = {
  january: 0, gennaio: 0, february: 1, febbraio: 1, march: 2, marzo: 2,
  april: 3, aprile: 3, may: 4, maggio: 4, june: 5, giugno: 5,
  july: 6, luglio: 6, august: 7, agosto: 7, september: 8, settembre: 8,
  october: 9, ottobre: 9, november: 10, novembre: 10, december: 11, dicembre: 11,
};

function startOfDay(date: Date) {
  const copy = new Date(date); copy.setHours(0, 0, 0, 0); return copy;
}

function unitMilliseconds(unit: string) {
  const value = unit.toLowerCase();
  if (/^(h|hr|hrs|hour|hours|ora|ore)$/.test(value)) return 3_600_000;
  if (/^(d|day|days|g|giorno|giorni)$/.test(value)) return 86_400_000;
  return 60_000;
}

function parseClock(text: string) {
  const meridiem = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (meridiem) {
    let hour = Number(meridiem[1]); const minute = Number(meridiem[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (meridiem[3].toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (meridiem[3].toLowerCase() === "am" && hour === 12) hour = 0;
    return { hour, minute, raw: meridiem[0] };
  }
  const hFormat = text.match(/\b([01]?\d|2[0-3])\s*h\s*([0-5]\d)?\b/i);
  if (hFormat) return { hour: Number(hFormat[1]), minute: Number(hFormat[2] ?? 0), raw: hFormat[0] };
  const colon = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (colon) return { hour: Number(colon[1]), minute: Number(colon[2]), raw: colon[0] };
  const prefixed = text.match(/\b(?:at|alle|ore|@)\s*([01]?\d|2[0-3])\b/i);
  if (prefixed) return { hour: Number(prefixed[1]), minute: 0, raw: prefixed[0] };
  if (/\b(noon|mezzogiorno)\b/i.test(text)) return { hour: 12, minute: 0, raw: text.match(/\b(noon|mezzogiorno)\b/i)![0] };
  if (/\b(midnight|mezzanotte)\b/i.test(text)) return { hour: 0, minute: 0, raw: text.match(/\b(midnight|mezzanotte)\b/i)![0] };
  return null;
}

export function parseReminder(input: string, now = new Date()): ParsedReminder | null {
  const clean = input.trim().replace(/\s+/g, " ");
  if (!clean) return null;

  const relative = clean.match(/\b(?:in|tra|fra)\s+(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|d|days?|g|ore?|minuti?|giorni?)\b/i)
    ?? clean.match(/\b(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|d|days?|g|ore?|minuti?|giorni?)\s*$/i);
  if (relative) {
    const amount = Number(relative[1].replace(",", "."));
    const dueAt = new Date(now.getTime() + amount * unitMilliseconds(relative[2]));
    const title = clean.replace(relative[0], "").replace(/^(remind me to|remember to|remember me to|ricordami di|ricordami)\s+/i, "").trim();
    return title && amount > 0 ? { title, dueAt } : null;
  }

  const clock = parseClock(clean);
  let hour = clock?.hour; let minute = clock?.minute;
  if (hour === undefined) {
    if (/\b(this evening|tonight|stasera)\b/i.test(clean)) { hour = 19; minute = 0; }
    else if (/\b(this morning|stamattina)\b/i.test(clean)) { hour = 8; minute = 0; }
    else if (/\b(this afternoon|questo pomeriggio)\b/i.test(clean)) { hour = 15; minute = 0; }
    else if (/\b(tomorrow morning|domattina)\b/i.test(clean)) { hour = 8; minute = 0; }
    else if (/\b(tomorrow evening|domani sera)\b/i.test(clean)) { hour = 19; minute = 0; }
    else return null;
  }

  let date = startOfDay(now);
  if (/\b(day after tomorrow|dopodomani)\b/i.test(clean)) date.setDate(date.getDate() + 2);
  else if (/\b(tomorrow|domani|domattina)\b/i.test(clean)) date.setDate(date.getDate() + 1);
  else {
    const slashDate = clean.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    const namedDate = clean.match(new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(months).join("|")})(?:\\s+(\\d{4}))?\\b`, "i"));
    const weekdayMatch = clean.toLowerCase().match(new RegExp(`\\b(${Object.keys(weekdays).join("|")})\\b`, "i"));
    if (slashDate) {
      const year = slashDate[3] ? Number(slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3]) : now.getFullYear();
      date = new Date(year, Number(slashDate[2]) - 1, Number(slashDate[1]));
      if (!slashDate[3] && date < startOfDay(now)) date.setFullYear(date.getFullYear() + 1);
    } else if (namedDate) {
      date = new Date(Number(namedDate[3] ?? now.getFullYear()), months[namedDate[2].toLowerCase()], Number(namedDate[1]));
      if (!namedDate[3] && date < startOfDay(now)) date.setFullYear(date.getFullYear() + 1);
    } else if (weekdayMatch) {
      const target = weekdays[weekdayMatch[1].toLowerCase()];
      let days = (target - now.getDay() + 7) % 7;
      if (days === 0) days = 7;
      date.setDate(date.getDate() + days);
    }
  }
  date.setHours(hour, minute ?? 0, 0, 0);
  if (!/\b(today|oggi|tomorrow|domani|dopodomani|day after tomorrow)\b/i.test(clean)
      && !Object.keys(weekdays).some((day) => new RegExp(`\\b${day}\\b`, "i").test(clean))
      && date <= now) date.setDate(date.getDate() + 1);

  let title = clean.replace(/^(remind me to|remember to|remember me to|ricordami di|ricordami)\s+/i, "");
  if (clock) title = title.replace(clock.raw, "").replace(/\b(at|alle|ore)\s*$/i, "");
  title = title
    .replace(/\b(today|oggi|tomorrow|domani|domattina|dopodomani|day after tomorrow|this evening|tonight|stasera|this morning|stamattina|this afternoon|questo pomeriggio|tomorrow morning|tomorrow evening|domani sera|next|on)\b/gi, "")
    .replace(new RegExp(`\\b(${Object.keys(weekdays).join("|")})\\b`, "gi"), "")
    .replace(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g, "")
    .replace(new RegExp(`\\b\\d{1,2}\\s+(${Object.keys(months).join("|")})(?:\\s+\\d{4})?\\b`, "gi"), "")
    .replace(/\s+/g, " ").trim();
  return title ? { title, dueAt: date } : null;
}

export function formatDue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function isoToLocalInput(value: string) {
  const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
