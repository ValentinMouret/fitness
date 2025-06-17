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
