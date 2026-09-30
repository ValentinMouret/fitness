import { describe, expect, test } from "vitest";
import { groupDailyHabits } from "./daily-habit-order";

const habit = (
  id: string,
  name: string,
  timeOfDay: string,
  isKeystone = false,
  completed = false,
) => ({ id, name, timeOfDay, isKeystone, completed });

describe("daily habit order", () => {
  test("orders both timed sections chronologically without keystone precedence", () => {
    const read = habit("read", "Read", "06:30");
    const meditate = habit("meditate", "Meditate", "08:00", true);
    const lunch = habit("lunch", "Lunch", "12:00");
    const evening = habit("evening", "Evening", "20:00", true);
    expect(groupDailyHabits([evening, meditate, lunch, read])).toEqual({
      morning: [read, meditate],
      laterToday: [lunch, evening],
      anytime: [],
    });
  });

  test("uses name then ID for equal times and anytime ties", () => {
    const a = habit("2", "Alpha", "08:00");
    const b = habit("1", "Alpha", "08:00");
    const c = habit("3", "Zulu", "08:00");
    const untimedA = habit("5", "Alpha", "");
    const untimedB = habit("4", "Alpha", "");
    const untimedC = habit("6", "Zulu", "", true);
    expect(groupDailyHabits([c, a, b, untimedC, untimedA, untimedB])).toEqual({
      morning: [b, a, c],
      laterToday: [],
      anytime: [untimedB, untimedA, untimedC],
    });
  });

  test.each([
    "",
    "24:00",
    "12:60",
    "-1:00",
    "8:00",
    "08:00:00",
    "noon",
    " 08:00",
  ])("treats missing or invalid time %j as anytime", (time) => {
    const value = habit("1", "Habit", time);
    expect(groupDailyHabits([value])).toEqual({
      morning: [],
      laterToday: [],
      anytime: [value],
    });
  });

  test("accepts day boundaries and preserves completed position without mutating input", () => {
    const last = habit("last", "Last", "23:59");
    const first = habit("first", "First", "00:00", false, true);
    const beforeNoon = habit("noon", "Before noon", "11:59");
    const input = Object.freeze([last, beforeNoon, first]);
    expect(groupDailyHabits(input)).toEqual({
      morning: [first, beforeNoon],
      laterToday: [last],
      anytime: [],
    });
    expect(input).toEqual([last, beforeNoon, first]);
  });

  test("returns empty sections when nothing is due", () => {
    expect(groupDailyHabits([])).toEqual({
      morning: [],
      laterToday: [],
      anytime: [],
    });
  });
});
