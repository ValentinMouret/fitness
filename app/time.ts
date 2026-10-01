import { z } from "zod";

export const timeZoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      if (value.startsWith("+") || value.startsWith("-")) return false;
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use a supported timezone");

// Calendar dates use UTC midnight as a date-only value, never as a local instant.
export function dateInTimeZone(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value;
  return fromDateString(`${part("year")}-${part("month")}-${part("day")}`);
}

export const allDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type Day = (typeof allDays)[number];

export const Day = {
  sortDays(days: ReadonlyArray<Day>): Day[] {
    return days.toSorted((a, b) => allDays.indexOf(a) - allDays.indexOf(b));
  },

  fromNumber(num: number): Day {
    // Sunday is 0 in JS, but Sunday is at index 6 in our array
    const adjustedNum = num === 0 ? 6 : num - 1;
    if (adjustedNum < 0 || adjustedNum >= allDays.length)
      throw new Error("Invalid day number");
    return allDays[adjustedNum];
  },

  toShort(day: Day): string {
    return `${day.slice(0, 3)}.`;
  },
};

export function isSameDay(t1: Date, t2: Date): boolean {
  return (
    t1.getFullYear() === t2.getFullYear() &&
    t1.getMonth() === t2.getMonth() &&
    t1.getDate() === t2.getDate()
  );
}

export function isSameCalendarDay(t1: Date, t2: Date): boolean {
  return (
    t1.getUTCFullYear() === t2.getUTCFullYear() &&
    t1.getUTCMonth() === t2.getUTCMonth() &&
    t1.getUTCDate() === t2.getUTCDate()
  );
}

export function toDate(d: Date): Date {
  const t = new Date(d);
  t.setUTCHours(0);
  t.setUTCMinutes(0);
  t.setUTCMilliseconds(0);
  t.setUTCSeconds(0);
  return t;
}

export function today(): Date {
  const now = new Date();
  return toDate(now);
}

export function addOneDay(t: Date): Date {
  const n = new Date(t);
  n.setDate(t.getDate() + 1);
  return n;
}

export function addCalendarDay(t: Date): Date {
  const n = new Date(t);
  n.setUTCDate(t.getUTCDate() + 1);
  return n;
}

export function removeOneDay(t: Date): Date {
  const n = new Date(t);
  n.setDate(t.getDate() - 1);
  return n;
}

export function removeCalendarDay(t: Date): Date {
  const n = new Date(t);
  n.setUTCDate(t.getUTCDate() - 1);
  return n;
}

export function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function formatStartedAgo(minutes: number): string {
  if (minutes === 0) {
    return "Started just now";
  }

  if (minutes === 1) {
    return "Started 1 min ago";
  }

  if (minutes < 60) {
    return `Started ${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 1 && remainingMinutes === 0) {
    return "Started 1 hour ago";
  }

  if (remainingMinutes === 0) {
    return `Started ${hours} hours ago`;
  }

  if (hours === 1) {
    return `Started 1 hour ${remainingMinutes} min ago`;
  }

  return `Started ${hours} hours ${remainingMinutes} min ago`;
}

export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function fromDateString(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}
