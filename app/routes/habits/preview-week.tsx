import { useState } from "react";

type MockHabit = {
  readonly id: string;
  readonly name: string;
  readonly identityPhrase: string;
  readonly scheduledDays: readonly string[];
  readonly timeOfDay: string;
  readonly location: string;
  readonly isKeystone: boolean;
  readonly color: string;
};

const MOCK_HABITS: readonly MockHabit[] = [
  {
    id: "1",
    name: "Morning Run",
    identityPhrase: "I am a runner who starts the day with movement",
    scheduledDays: ["Monday", "Wednesday", "Friday"],
    timeOfDay: "07:00",
    location: "Parc de la Tête d'Or",
    isKeystone: true,
    color: "#e15a46",
  },
  {
    id: "2",
    name: "Weight & Supplements",
    identityPhrase: "I am someone who tracks and fuels their body with care",
    scheduledDays: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    timeOfDay: "07:30",
    location: "Kitchen",
    isKeystone: false,
    color: "#f59e0b",
  },
  {
    id: "3",
    name: "Read",
    identityPhrase: "I am a reader who grows through ideas",
    scheduledDays: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    timeOfDay: "21:30",
    location: "Bedroom",
    isKeystone: false,
    color: "#6366f1",
  },
  {
    id: "4",
    name: "Gym",
    identityPhrase: "I am someone who shows up and builds strength",
    scheduledDays: ["Tuesday", "Thursday", "Saturday"],
    timeOfDay: "18:00",
    location: "Fitness Park",
    isKeystone: false,
    color: "#22c55e",
  },
];

const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const WEEK_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_DATES = [
  "Mar 10",
  "Mar 11",
  "Mar 12",
  "Mar 13",
  "Mar 14",
  "Mar 15",
  "Mar 16",
];
const TODAY_INDEX = 5;

// Fixed seed completions [Mon=0 … Sun=6]
const COMPLETIONS: Record<string, readonly boolean[]> = {
  "1": [true, false, true, false, true, false, false],
  "2": [true, true, true, true, true, true, false],
  "3": [true, true, false, false, true, false, false],
  "4": [false, true, false, true, false, false, false],
};

type CellState = "done" | "missed" | "today-pending" | "future" | "off";

function getCellState(
  habit: MockHabit,
  day: number,
  toggles: ReadonlySet<string> = new Set(),
): CellState {
  if (!habit.scheduledDays.includes(DAY_FULL[day])) return "off";
  if (day > TODAY_INDEX) return "future";
  if (toggles.has(`${habit.id}-${day}`) || COMPLETIONS[habit.id][day])
    return "done";
  if (day < TODAY_INDEX) return "missed";
  return "today-pending";
}

function habitsOnDay(day: number): readonly MockHabit[] {
  return MOCK_HABITS.filter((h) => h.scheduledDays.includes(DAY_FULL[day]));
}

function doneCountOnDay(day: number): number {
  return habitsOnDay(day).filter((h) => COMPLETIONS[h.id][day]).length;
}

function hasMissedTwice(habit: MockHabit): boolean {
  let run = 0;
  for (let d = 0; d < TODAY_INDEX; d++) {
    if (!habit.scheduledDays.includes(DAY_FULL[d])) continue;
    if (COMPLETIONS[habit.id][d]) {
      run = 0;
    } else {
      run++;
    }
    if (run >= 2) return true;
  }
  return false;
}

// ─── Design A — The Week Grid ─────────────────────────────────────────────────

const DESIGN_A_STYLES = `
  @keyframes checkPop {
    0%   { transform: scale(0); opacity: 0; }
    55%  { transform: scale(1.3); opacity: 1; }
    75%  { transform: scale(0.88); }
    100% { transform: scale(1); }
  }
  @keyframes ringBounce {
    0%   { transform: scale(1); }
    35%  { transform: scale(1.09); }
    65%  { transform: scale(0.95); }
    82%  { transform: scale(1.03); }
    100% { transform: scale(1); }
  }
  .check-pop { animation: checkPop 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .ring-bounce { animation: ringBounce 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
`;

function DesignA() {
  const [toggles, setToggles] = useState<Set<string>>(new Set());
  const [ringKey, setRingKey] = useState(0);
  const [popKey, setPopKey] = useState<string | null>(null);

  function toggle(habitId: string, day: number) {
    const key = `${habitId}-${day}`;
    const next = new Set(toggles);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      setPopKey(key);
      setTimeout(() => setPopKey(null), 500);
      setRingKey((k) => k + 1);
    }
    setToggles(next);
  }

  let totalScheduled = 0;
  let totalDone = 0;
  for (const h of MOCK_HABITS) {
    for (let d = 0; d <= TODAY_INDEX; d++) {
      if (!h.scheduledDays.includes(DAY_FULL[d])) continue;
      totalScheduled++;
      if (getCellState(h, d, toggles) === "done") totalDone++;
    }
  }

  const circumference = 2 * Math.PI * 36;
  const progress = totalDone / totalScheduled;

  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#1c1917",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "44px 20px 16px", color: "#faf9f7" }}>
        <div
          style={{
            fontSize: 11,
            color: "#a8a29e",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Week of March 10–16
        </div>
        <div
          style={{
            fontSize: 24,
            fontFamily: "Crimson Pro, Georgia, serif",
            fontWeight: 600,
          }}
        >
          Your week at a glance.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "4px 20px 22px",
        }}
      >
        <div
          key={ringKey}
          className="ring-bounce"
          style={{ position: "relative", width: 88, height: 88 }}
        >
          <svg
            aria-hidden="true"
            width={88}
            height={88}
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={44}
              cy={44}
              r={36}
              fill="none"
              stroke="#292524"
              strokeWidth={7}
            />
            <circle
              cx={44}
              cy={44}
              r={36}
              fill="none"
              stroke="#e15a46"
              strokeWidth={7}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 0.55s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#faf9f7",
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontFamily: "Crimson Pro, Georgia, serif",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {totalDone}/{totalScheduled}
            </span>
            <span style={{ fontSize: 10, color: "#a8a29e", marginTop: 1 }}>
              this week
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          background: "#faf9f7",
          borderRadius: "24px 24px 0 0",
          padding: "18px 12px 32px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "82px repeat(7, 1fr)",
            gap: 3,
            marginBottom: 6,
          }}
        >
          <div />
          {WEEK_SHORT.map((d, i) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: 10,
                fontWeight: i === TODAY_INDEX ? 700 : 500,
                color: i === TODAY_INDEX ? "#1c1917" : "#b5b0a8",
                background: i === TODAY_INDEX ? "#f0ede8" : "transparent",
                borderRadius: 6,
                padding: "2px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {MOCK_HABITS.map((habit) => (
            <div
              key={habit.id}
              style={{
                display: "grid",
                gridTemplateColumns: "82px repeat(7, 1fr)",
                gap: 3,
                alignItems: "center",
              }}
            >
              <div style={{ paddingRight: 6 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    marginBottom: 1,
                  }}
                >
                  {habit.isKeystone && <span style={{ fontSize: 10 }}>⚡</span>}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#1c1917",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {habit.name.split(" ")[0]}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: "#b5b0a8" }}>
                  {habit.timeOfDay}
                </div>
              </div>

              {WEEK_SHORT.map((_d, dayIndex) => {
                const state = getCellState(habit, dayIndex, toggles);
                const isToday = dayIndex === TODAY_INDEX;
                const canToggle = isToday && state !== "off";
                const cellKey = `${habit.id}-${dayIndex}`;

                return (
                  <div
                    key={WEEK_SHORT[dayIndex]}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: 38,
                      background: isToday ? "#f0ede8" : "transparent",
                      borderRadius: 8,
                      cursor: canToggle ? "pointer" : "default",
                      opacity: dayIndex > TODAY_INDEX ? 0.4 : 1,
                    }}
                    onClick={() => canToggle && toggle(habit.id, dayIndex)}
                  >
                    {state === "off" ? (
                      <div
                        style={{
                          width: 8,
                          height: 2,
                          background: "#e0dcd7",
                          borderRadius: 1,
                        }}
                      />
                    ) : state === "done" ? (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: habit.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg
                          className={popKey === cellKey ? "check-pop" : ""}
                          width={11}
                          height={11}
                          viewBox="0 0 11 11"
                          fill="none"
                        >
                          <path
                            d="M2 5.5l2.5 2.5 4.5-4.5"
                            stroke="#fff"
                            strokeWidth={1.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    ) : state === "missed" ? (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: `2px solid ${habit.color}55`,
                          background: `${habit.color}0a`,
                        }}
                      />
                    ) : state === "today-pending" ? (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: `2px dashed ${habit.color}`,
                          background: `${habit.color}10`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: "2px solid #e7e5e4",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid #f0ede8",
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          {[
            {
              label: "Done",
              dot: (
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#e15a46",
                  }}
                />
              ),
            },
            {
              label: "Missed",
              dot: (
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "2px solid #e15a4666",
                  }}
                />
              ),
            },
            {
              label: "Today (tap)",
              dot: (
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "2px dashed #79756d",
                  }}
                />
              ),
            },
            {
              label: "Not scheduled",
              dot: (
                <div
                  style={{
                    width: 12,
                    height: 2,
                    background: "#e0dcd7",
                    borderRadius: 1,
                  }}
                />
              ),
            },
          ].map(({ label, dot }) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              {dot}
              <span style={{ fontSize: 10, color: "#b5b0a8" }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            type="button"
            onClick={() => {
              setToggles(new Set());
              setRingKey((k) => k + 1);
            }}
            style={{
              background: "transparent",
              border: "1px solid #e7e5e4",
              borderRadius: 20,
              padding: "5px 14px",
              fontSize: 11,
              color: "#c4bfba",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reset demo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Design B — Day-by-Day Scroll ────────────────────────────────────────────

function DesignB() {
  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#f7f4ef",
        minHeight: "100%",
        padding: "44px 16px 32px",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: "#a8a29e",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Week of March 10–16
        </div>
        <div
          style={{
            fontSize: 22,
            fontFamily: "Crimson Pro, Georgia, serif",
            fontWeight: 600,
            color: "#1c1917",
          }}
        >
          Day by day.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {WEEK_SHORT.map((_d, dayIndex) => {
          const isToday = dayIndex === TODAY_INDEX;
          const isPast = dayIndex < TODAY_INDEX;
          const isFuture = dayIndex > TODAY_INDEX;
          const dayHabits = habitsOnDay(dayIndex);
          const doneCount = isPast
            ? doneCountOnDay(dayIndex)
            : isToday
              ? doneCountOnDay(TODAY_INDEX)
              : 0;

          if (isFuture) {
            return (
              <div
                key={WEEK_SHORT[dayIndex]}
                style={{
                  background: "#fff",
                  border: "1px solid #ede9e3",
                  borderRadius: 12,
                  padding: "10px 14px",
                  opacity: 0.45,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#79756d",
                      }}
                    >
                      {WEEK_SHORT[dayIndex]}
                    </span>
                    <span style={{ fontSize: 11, color: "#b5b0a8" }}>
                      {WEEK_DATES[dayIndex]}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "#c4bfba" }}>
                    {dayHabits.length} habit{dayHabits.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#c4bfba",
                    marginTop: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dayHabits.map((h) => h.name).join(" · ")}
                </div>
              </div>
            );
          }

          if (isPast) {
            return (
              <div
                key={WEEK_SHORT[dayIndex]}
                style={{
                  background: "#fff",
                  border: "1px solid #ede9e3",
                  borderRadius: 12,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#79756d",
                      }}
                    >
                      {WEEK_SHORT[dayIndex]}
                    </span>
                    <span style={{ fontSize: 11, color: "#b5b0a8" }}>
                      {WEEK_DATES[dayIndex]}
                    </span>
                    <div
                      style={{
                        fontSize: 11,
                        background:
                          doneCount === dayHabits.length
                            ? "#dcfce7"
                            : "#f5f4f2",
                        color:
                          doneCount === dayHabits.length
                            ? "#16a34a"
                            : "#79756d",
                        borderRadius: 20,
                        padding: "2px 8px",
                        fontWeight: 500,
                      }}
                    >
                      {doneCount}/{dayHabits.length}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {dayHabits.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: COMPLETIONS[h.id][dayIndex]
                            ? h.color
                            : "#e7e5e4",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          // Today — expanded hero card
          return (
            <div
              key={WEEK_SHORT[dayIndex]}
              style={{
                background: "#fff",
                border: "2px solid #e7e5e4",
                borderRadius: 16,
                padding: "16px 14px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#a8a29e",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 2,
                    }}
                  >
                    {WEEK_DATES[dayIndex]}
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontFamily: "Crimson Pro, Georgia, serif",
                      fontWeight: 600,
                      color: "#1c1917",
                    }}
                  >
                    Today
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1c1917",
                    background: "#f0ede8",
                    borderRadius: 20,
                    padding: "4px 10px",
                  }}
                >
                  {doneCount}/{dayHabits.length}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayHabits.map((habit) => {
                  const done = COMPLETIONS[habit.id][TODAY_INDEX];
                  return (
                    <div
                      key={habit.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        background: done ? `${habit.color}0f` : "#faf9f7",
                        borderRadius: 10,
                        border: `1px solid ${done ? `${habit.color}30` : "#f0ede8"}`,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: done ? habit.color : "transparent",
                          border: `2px solid ${done ? habit.color : "#d6d3d1"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {done && (
                          <svg
                            width={12}
                            height={12}
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2 6l2.5 2.5 5.5-5"
                              stroke="#fff"
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: done ? "#a8a29e" : "#1c1917",
                            textDecoration: done ? "line-through" : "none",
                          }}
                        >
                          {habit.isKeystone ? "⚡ " : ""}
                          {habit.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#b5b0a8" }}>
                          {habit.timeOfDay} · {habit.location}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid #f0ede8",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "1px solid #e7e5e4",
                    borderRadius: 20,
                    padding: "5px 14px",
                    fontSize: 11,
                    color: "#b5b0a8",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Log minimum →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Design C — Habit Rows with 7-Day Strip ───────────────────────────────────

function DesignC() {
  let totalScheduled = 0;
  let totalDone = 0;
  for (const h of MOCK_HABITS) {
    for (let d = 0; d <= TODAY_INDEX; d++) {
      if (!h.scheduledDays.includes(DAY_FULL[d])) continue;
      totalScheduled++;
      if (COMPLETIONS[h.id][d]) totalDone++;
    }
  }

  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#f7f4ef",
        minHeight: "100%",
        padding: "44px 16px 32px",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: "#a8a29e",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          March 10–16 · Week Review
        </div>
        <div
          style={{
            fontSize: 22,
            fontFamily: "Crimson Pro, Georgia, serif",
            fontWeight: 600,
            color: "#1c1917",
          }}
        >
          Consistency is evidence.
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #ede9e3",
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <span style={{ fontSize: 13, color: "#79756d" }}>
              Week progress
            </span>
            <span style={{ fontSize: 11, color: "#b5b0a8", marginLeft: 6 }}>
              Mon–Sat
            </span>
          </div>
          <span
            style={{
              fontSize: 15,
              fontFamily: "Crimson Pro, Georgia, serif",
              fontWeight: 700,
              color: "#1c1917",
            }}
          >
            {totalDone}/{totalScheduled}
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: "#f0ede8",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(totalDone / totalScheduled) * 100}%`,
              background: "#e15a46",
              borderRadius: 3,
            }}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            marginTop: 8,
          }}
        >
          {WEEK_SHORT.map((d, i) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: 9,
                color:
                  i === TODAY_INDEX
                    ? "#1c1917"
                    : i > TODAY_INDEX
                      ? "#c4bfba"
                      : "#a8a29e",
                fontWeight: i === TODAY_INDEX ? 700 : 400,
                borderBottom:
                  i === TODAY_INDEX
                    ? "2px solid #e15a46"
                    : "2px solid transparent",
                paddingBottom: 2,
              }}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_HABITS.map((habit) => {
          const missedTwice = hasMissedTwice(habit);
          let weekTotal = 0;
          let weekDone = 0;
          for (let d = 0; d <= TODAY_INDEX; d++) {
            if (!habit.scheduledDays.includes(DAY_FULL[d])) continue;
            weekTotal++;
            if (COMPLETIONS[habit.id][d]) weekDone++;
          }

          return (
            <div
              key={habit.id}
              style={{
                background: "#fff",
                border: "1px solid #ede9e3",
                borderRadius: 12,
                borderLeft: `4px solid ${habit.color}`,
                padding: "12px 14px",
              }}
            >
              {missedTwice && (
                <div
                  style={{
                    background: "#fff8f0",
                    border: "1px solid #fcd9a8",
                    borderRadius: 6,
                    padding: "5px 10px",
                    fontSize: 11,
                    color: "#b45309",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>⚠</span>
                  <span>Never miss twice — get back on track tonight.</span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 2,
                    }}
                  >
                    {habit.isKeystone && (
                      <span style={{ fontSize: 12 }}>⚡</span>
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1c1917",
                      }}
                    >
                      {habit.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#a8a29e" }}>
                    {habit.timeOfDay} · {habit.location}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: weekDone === weekTotal ? "#22c55e" : habit.color,
                    }}
                  >
                    {weekDone}/{weekTotal}
                  </div>
                  <div style={{ fontSize: 10, color: "#b5b0a8" }}>
                    this week
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 4,
                }}
              >
                {WEEK_SHORT.map((_d, dayIndex) => {
                  const state = getCellState(habit, dayIndex);
                  const isToday = dayIndex === TODAY_INDEX;
                  return (
                    <div
                      key={WEEK_SHORT[dayIndex]}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          borderRadius: 4,
                          background:
                            state === "done"
                              ? habit.color
                              : state === "missed"
                                ? `${habit.color}18`
                                : state === "today-pending"
                                  ? `${habit.color}22`
                                  : state === "future"
                                    ? "#f0ede8"
                                    : "#f7f4ef",
                          border:
                            state === "today-pending"
                              ? `2px dashed ${habit.color}`
                              : state === "missed"
                                ? `1px solid ${habit.color}33`
                                : isToday && state !== "off"
                                  ? "2px solid #e7e5e4"
                                  : "1px solid transparent",
                          opacity: state === "future" ? 0.5 : 1,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          color: isToday
                            ? "#1c1917"
                            : dayIndex > TODAY_INDEX
                              ? "#c4bfba"
                              : "#b5b0a8",
                          fontWeight: isToday ? 700 : 400,
                        }}
                      >
                        {WEEK_SHORT[dayIndex][0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Preview wrapper ──────────────────────────────────────────────────────────

const DESIGNS = [
  {
    label: "A — Week Grid",
    tagline: "Habits × days matrix. Tap today's cells to toggle.",
    component: <DesignA />,
  },
  {
    label: "B — Day by Day",
    tagline: "Scroll through the week. Today expanded, past compact.",
    component: <DesignB />,
  },
  {
    label: "C — Habit Strips",
    tagline: "Per-habit 7-day strips. Spot patterns. Never miss twice.",
    component: <DesignC />,
  },
];

export default function HabitsPreviewWeek() {
  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#f8f7f5",
        minHeight: "100vh",
        padding: "40px 48px",
      }}
    >
      <style>{DESIGN_A_STYLES}</style>

      <div style={{ marginBottom: 40 }}>
        <h1
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#79756d",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            margin: 0,
          }}
        >
          Habits Weekly View · 3 concepts
        </h1>
      </div>

      <div
        style={{
          display: "flex",
          gap: 48,
          overflowX: "auto",
          paddingBottom: 40,
          alignItems: "flex-start",
        }}
      >
        {DESIGNS.map((design) => (
          <div key={design.label} style={{ flexShrink: 0, width: 375 }}>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1c1917",
                  marginBottom: 4,
                }}
              >
                {design.label}
              </div>
              <div style={{ fontSize: 13, color: "#a8a29e" }}>
                {design.tagline}
              </div>
            </div>
            <div
              style={{
                width: 375,
                height: 812,
                borderRadius: 44,
                border: "10px solid #1c1917",
                boxShadow:
                  "0 24px 64px rgba(0,0,0,0.18), inset 0 0 0 2px #3a3632",
                overflow: "hidden",
                background: "#fff",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 120,
                  height: 28,
                  background: "#1c1917",
                  borderRadius: "0 0 16px 16px",
                  zIndex: 10,
                }}
              />
              <div style={{ height: "100%", overflowY: "auto" }}>
                {design.component}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
