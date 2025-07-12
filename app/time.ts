export const allDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type Day = (typeof allDays)[number];

export const Day = {
  sortDays(days: Day[]): Day[] {
    return days.toSorted((a, b) => allDays.indexOf(a) - allDays.indexOf(b));
  },

  // From `Date.getDay()`
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

export function removeOneDay(t: Date): Date {
  const n = new Date(t);
  n.setDate(t.getDate() - 1);
  return n;
}
