import { data, useFetcher } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { getScheduledDays, type Habit } from "~/modules/habits/domain/entity";
import { deleteHabit } from "~/modules/habits/infra/delete-habit.service.server";
import {
  getHabitsWeekData,
  toggleWeekHabitCompletion,
} from "~/modules/habits/infra/habits-week.service.server";
import { HabitWeekDeleteControl } from "~/modules/habits/presentation/components/HabitWeekDeleteControl";
import { allDays } from "~/time";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/week";

const STYLES = `
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

const WEEK_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HABIT_GRID_COLUMNS = "96px repeat(7, minmax(0, 1fr)) 32px";

export async function loader() {
  return getHabitsWeekData();
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intentParsed = zfd
    .formData({ intent: formOptionalText() })
    .parse(formData);

  if (intentParsed.intent === "toggle-completion") {
    const schema = zfd.formData({
      habitId: formText(z.string().min(1)),
      completed: formText(z.enum(["true", "false"])),
      date: formOptionalText(),
    });
    const parsed = schema.parse(formData);
    const targetDate = parsed.date ? new Date(parsed.date) : undefined;

    const result = await toggleWeekHabitCompletion({
      habitId: parsed.habitId,
      completed: parsed.completed === "true",
      date: targetDate,
    });

    if (!result.ok) {
      return data({ error: result.error }, { status: result.status });
    }
    return data({ success: true });
  }

  if (intentParsed.intent === "delete-habit") {
    const schema = zfd.formData({
      habitId: formText(z.string().min(1)),
    });
    const parsed = schema.parse(formData);

    const result = await deleteHabit(parsed.habitId);

    if (!result.ok) {
      return data({ error: result.error }, { status: result.status });
    }

    return data({ success: true });
  }

  return null;
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const startStr = weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endStr = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

type CellState = "done" | "missed" | "today-pending" | "future" | "off";

function getCellState(
  habit: Habit,
  dayIndex: number,
  todayIndex: number,
  completed: boolean,
): CellState {
  const scheduledDays = getScheduledDays(habit);
  if (!scheduledDays.includes(allDays[dayIndex])) return "off";
  if (dayIndex > todayIndex) return "future";
  if (completed) return "done";
  if (dayIndex < todayIndex) return "missed";
  return "today-pending";
}

type TodayCellProps = {
  habit: Habit;
  isCompleted: boolean;
};

function TodayCell({ habit, isCompleted }: TodayCellProps) {
  const fetcher = useFetcher();
  const submitting = fetcher.state !== "idle";
  const displayCompleted = submitting ? !isCompleted : isCompleted;

  function toggle() {
    fetcher.submit(
      {
        intent: "toggle-completion",
        habitId: habit.id,
        completed: String(isCompleted),
      },
      { method: "post" },
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: 38,
        width: "100%",
        background: "#f0ede8",
        borderRadius: 8,
        cursor: "pointer",
        border: "none",
        padding: 0,
      }}
    >
      {displayCompleted ? (
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
            aria-hidden="true"
            className={submitting ? "check-pop" : ""}
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
      ) : (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: `2px dashed ${habit.color}`,
            background: `${habit.color}10`,
          }}
        />
      )}
    </button>
  );
}

function PastCell({
  habit,
  isCompleted,
  date,
}: {
  habit: Habit;
  isCompleted: boolean;
  date: Date;
}) {
  const fetcher = useFetcher();
  const submitting = fetcher.state !== "idle";
  const displayCompleted = submitting ? !isCompleted : isCompleted;

  function toggle() {
    fetcher.submit(
      {
        intent: "toggle-completion",
        habitId: habit.id,
        completed: String(isCompleted),
        date: date.toISOString().split("T")[0],
      },
      { method: "post" },
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: 38,
        width: "100%",
        background: "#f0ede8",
        borderRadius: 8,
        cursor: "pointer",
        border: "none",
        padding: 0,
      }}
    >
      {displayCompleted ? (
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
            aria-hidden="true"
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
      ) : (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: `2px solid ${habit.color}55`,
            background: `${habit.color}0a`,
          }}
        />
      )}
    </button>
  );
}

function TabBar({ active }: { active: "today" | "week" }) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        marginTop: "auto",
        background: "rgba(28, 25, 23, 0.96)",
        backdropFilter: "blur(18px)",
        borderTop: "1px solid #292524",
        boxShadow: "0 -10px 28px rgba(0, 0, 0, 0.18)",
        padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
        display: "flex",
        gap: 8,
      }}
    >
      <a
        href="/"
        style={{
          flex: 1,
          padding: "10px 0",
          borderRadius: 10,
          background: "transparent",
          border: "1px solid #3d3935",
          color: "#6b6560",
          fontSize: 12,
          fontWeight: 500,
          textAlign: "center",
          textDecoration: "none",
          fontFamily: "DM Sans, system-ui, sans-serif",
        }}
      >
        ← App
      </a>
      <a
        href="/habits"
        style={{
          flex: 1.5,
          padding: "10px 0",
          borderRadius: 10,
          background: active === "today" ? "#e15a46" : "transparent",
          border: active === "today" ? "none" : "1px solid #3d3935",
          color: active === "today" ? "#fff" : "#a8a29e",
          fontSize: 13,
          fontWeight: 600,
          textAlign: "center",
          textDecoration: "none",
          fontFamily: "DM Sans, system-ui, sans-serif",
        }}
      >
        Today
      </a>
      <a
        href="/habits/week"
        style={{
          flex: 1.5,
          padding: "10px 0",
          borderRadius: 10,
          background: active === "week" ? "#e15a46" : "transparent",
          border: active === "week" ? "none" : "1px solid #3d3935",
          color: active === "week" ? "#fff" : "#a8a29e",
          fontSize: 13,
          fontWeight: 600,
          textAlign: "center",
          textDecoration: "none",
          fontFamily: "DM Sans, system-ui, sans-serif",
        }}
      >
        Week
      </a>
    </div>
  );
}

export default function HabitsWeekPage({ loaderData }: Route.ComponentProps) {
  const { habits, weekStart, todayIndex, completionMap, todayCompletionMap } =
    loaderData;

  const weekHabits = habits.filter((h) => h.frequencyType !== "monthly");

  let totalScheduled = 0;
  let totalDone = 0;
  for (const habit of weekHabits) {
    for (let d = 0; d <= todayIndex; d++) {
      const scheduled = getScheduledDays(habit).includes(allDays[d]);
      if (!scheduled) continue;
      totalScheduled++;
      if (completionMap[habit.id]?.[d]) totalDone++;
    }
  }

  const circumference = 2 * Math.PI * 36;
  const progress = totalScheduled > 0 ? totalDone / totalScheduled : 0;

  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#1c1917",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{STYLES}</style>

      <div
        style={{
          padding: "calc(env(safe-area-inset-top) + 16px) 20px 16px",
          color: "#faf9f7",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#a8a29e",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {weekStart instanceof Date
            ? formatWeekRange(weekStart)
            : formatWeekRange(new Date(weekStart))}
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
          padding: "18px 12px 112px",
          overflowY: "auto",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: HABIT_GRID_COLUMNS,
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
                fontWeight: i === todayIndex ? 700 : 500,
                color: i === todayIndex ? "#1c1917" : "#b5b0a8",
                background: i === todayIndex ? "#f0ede8" : "transparent",
                borderRadius: 6,
                padding: "2px 0",
              }}
            >
              {d}
            </div>
          ))}
          <div />
        </div>

        {/* Habit rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {weekHabits.map((habit) => (
            <div
              key={habit.id}
              style={{
                display: "grid",
                gridTemplateColumns: HABIT_GRID_COLUMNS,
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
                    {habit.name}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: "#b5b0a8" }}>
                  {habit.timeOfDay}
                </div>
              </div>

              {WEEK_SHORT.map((day, dayIndex) => {
                const completed = completionMap[habit.id]?.[dayIndex] ?? false;
                const state = getCellState(
                  habit,
                  dayIndex,
                  todayIndex,
                  completed,
                );
                const isToday = dayIndex === todayIndex;

                if (isToday && state !== "off") {
                  return (
                    <TodayCell
                      key={day}
                      habit={habit}
                      isCompleted={todayCompletionMap[habit.id] ?? false}
                    />
                  );
                }

                if (dayIndex < todayIndex && state !== "off") {
                  const cellDate = new Date(
                    weekStart instanceof Date ? weekStart : new Date(weekStart),
                  );
                  cellDate.setDate(cellDate.getDate() + dayIndex);
                  return (
                    <PastCell
                      key={day}
                      habit={habit}
                      isCompleted={completed}
                      date={cellDate}
                    />
                  );
                }

                return (
                  <div
                    key={day}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: 38,
                      opacity: dayIndex > todayIndex ? 0.4 : 1,
                    }}
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
                    ) : state === "future" ? (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: "2px solid #e7e5e4",
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}

              <HabitWeekDeleteControl
                habitId={habit.id}
                name={habit.name}
                identityPhrase={habit.identityPhrase}
                timeOfDay={habit.timeOfDay}
                color={habit.color}
              />
            </div>
          ))}
        </div>

        {/* Legend */}
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
      </div>

      <TabBar active="week" />
    </div>
  );
}
