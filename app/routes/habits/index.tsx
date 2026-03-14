import { data, useFetcher } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import type { Habit } from "~/modules/habits/domain/entity";
import {
  getHabitsPageData,
  toggleHabitCompletion,
} from "~/modules/habits/infra/habits-page.service.server";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/index";

const STYLES = `
  @keyframes checkPop {
    0%   { transform: scale(0); opacity: 0; }
    55%  { transform: scale(1.3); opacity: 1; }
    75%  { transform: scale(0.88); }
    100% { transform: scale(1); }
  }
  @keyframes headingIn {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ringBounce {
    0%   { transform: scale(1); }
    35%  { transform: scale(1.09); }
    65%  { transform: scale(0.95); }
    82%  { transform: scale(1.03); }
    100% { transform: scale(1); }
  }
  @keyframes subIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .check-pop { animation: checkPop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .heading-in { animation: headingIn 0.35s ease forwards; }
  .ring-bounce { animation: ringBounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .sub-in { animation: subIn 0.4s ease 0.18s both; }
  .habit-card-a { transition: border-left-color 0.3s ease, box-shadow 0.3s ease; }
`;

export async function loader() {
  return getHabitsPageData();
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
      notes: formOptionalText(),
    });
    const parsed = schema.parse(formData);

    const result = await toggleHabitCompletion({
      habitId: parsed.habitId,
      completed: parsed.completed === "true",
      notes: parsed.notes,
    });

    if (!result.ok) {
      return data({ error: result.error }, { status: result.status });
    }
    return data({ success: true, hitMilestone: result.hitMilestone });
  }

  return null;
}

function isMorning(timeOfDay: string): boolean {
  if (!timeOfDay) return true;
  return parseInt(timeOfDay.split(":")[0], 10) < 12;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

type HabitCardProps = {
  habit: Habit;
  isCompleted: boolean;
  completionCount: number;
  evening?: boolean;
};

function HabitCard({
  habit,
  isCompleted,
  completionCount,
  evening,
}: HabitCardProps) {
  const fetcher = useFetcher();
  const submitting = fetcher.state !== "idle";
  const displayCompleted = submitting ? !isCompleted : isCompleted;
  const isMinSub = submitting && fetcher.formData?.get("notes") === "minimum";
  const displayCount =
    completionCount + (submitting ? (isCompleted ? -1 : 1) : 0);

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

  function logMinimum(e: React.MouseEvent) {
    e.stopPropagation();
    if (isCompleted) return;
    fetcher.submit(
      {
        intent: "toggle-completion",
        habitId: habit.id,
        completed: "false",
        notes: "minimum",
      },
      { method: "post" },
    );
  }

  const borderColor = displayCompleted
    ? habit.color
    : evening
      ? "#f0ede8"
      : "#e7e5e4";

  return (
    // biome-ignore lint/a11y/useSemanticElements: outer card can't be <button> — contains a nested <button>
    <div
      className="habit-card-a"
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") toggle();
      }}
      style={{
        background: "#fff",
        borderRadius: 14,
        borderLeft: `4px solid ${borderColor}`,
        boxShadow: displayCompleted
          ? `0 2px 10px ${habit.color}22`
          : "0 1px 3px rgba(0,0,0,0.06)",
        cursor: "pointer",
        overflow: "hidden",
        opacity: evening && !displayCompleted ? 0.55 : 1,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          minHeight: 64,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: 2,
            background: displayCompleted ? habit.color : "transparent",
            border: `${evening && !displayCompleted ? "2px dashed" : "2px solid"} ${displayCompleted ? habit.color : "#d6d3d1"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s ease, border-color 0.2s ease",
          }}
        >
          {displayCompleted && (
            <svg
              aria-hidden="true"
              className="check-pop"
              width={14}
              height={14}
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M2.5 7l3 3 6-6"
                stroke="#fff"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 2,
            }}
          >
            {habit.isKeystone && <span style={{ fontSize: 13 }}>⚡</span>}
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: displayCompleted ? "#a8a29e" : "#1c1917",
                textDecoration: displayCompleted ? "line-through" : "none",
              }}
            >
              {habit.name}
            </span>
            {isMinSub && (
              <span
                style={{
                  fontSize: 10,
                  color: "#a8a29e",
                  background: "#f5f4f2",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontWeight: 500,
                }}
              >
                min
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#a8a29e",
              lineHeight: 1.4,
              marginBottom: 4,
            }}
          >
            {habit.identityPhrase}
          </div>
          <div style={{ fontSize: 11, color: "#c4bfba" }}>
            <span
              style={{
                fontFamily: "Crimson Pro, Georgia, serif",
                fontSize: 13,
                fontWeight: 700,
                color: displayCompleted ? habit.color : "#c4bfba",
              }}
            >
              {displayCount}
            </span>{" "}
            votes cast
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#c4bfba",
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          {habit.timeOfDay}
        </div>
      </div>

      {!displayCompleted && !evening && (
        <div
          style={{
            borderTop: "1px solid #f5f4f2",
            padding: "9px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#faf9f7",
          }}
        >
          <span style={{ fontSize: 11, color: "#b5b0a8" }}>
            Struggling today?
          </span>
          <button
            type="button"
            onClick={logMinimum}
            style={{
              background: "transparent",
              border: "1px solid #e7e5e4",
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 11,
              color: "#79756d",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Log minimum <span style={{ color: "#b5b0a8" }}>→</span>
          </button>
        </div>
      )}
    </div>
  );
}

function TabBar({ active }: { active: "today" | "week" }) {
  return (
    <div
      style={{
        background: "#1c1917",
        padding: "12px 20px 28px",
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

export default function HabitsPage({ loaderData }: Route.ComponentProps) {
  const { todayHabits, completionMap, completionCounts, completedTodayCount } =
    loaderData;

  const morningHabits = todayHabits.filter((h) => isMorning(h.timeOfDay));
  const eveningHabits = todayHabits.filter((h) => !isMorning(h.timeOfDay));

  const allMorningDone =
    morningHabits.length > 0 && morningHabits.every((h) => completionMap[h.id]);

  const totalScheduled = todayHabits.length;
  const progress =
    totalScheduled > 0 ? completedTodayCount / totalScheduled : 0;
  const circumference = 2 * Math.PI * 52;
  const ringColor = allMorningDone ? "#22c55e" : "#e15a46";

  const firstUncompleteEvening = eveningHabits.find(
    (h) => !completionMap[h.id],
  );

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

      {/* Header */}
      <div style={{ padding: "44px 24px 18px", color: "#faf9f7" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: "#a8a29e",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {formatDate(new Date())}
            </div>
            <div
              className="heading-in"
              style={{
                fontSize: 28,
                fontFamily: "Crimson Pro, Georgia, serif",
                fontWeight: 600,
              }}
            >
              {allMorningDone
                ? "Morning done. You showed up."
                : "Good morning."}
            </div>
            {allMorningDone && firstUncompleteEvening && (
              <div
                className="sub-in"
                style={{ fontSize: 13, color: "#a8a29e", marginTop: 5 }}
              >
                {firstUncompleteEvening.name} is up tonight at{" "}
                {firstUncompleteEvening.timeOfDay}.
              </div>
            )}
          </div>
          <a
            href="/habits/new"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid #3d3935",
              color: "#6b6560",
              textDecoration: "none",
              fontSize: 20,
              lineHeight: 1,
              flexShrink: 0,
              marginTop: 4,
            }}
          >
            +
          </a>
        </div>
      </div>

      {/* Progress ring */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "10px 24px 26px",
        }}
      >
        <div
          className={allMorningDone ? "ring-bounce" : ""}
          style={{ position: "relative", width: 120, height: 120 }}
        >
          <svg
            aria-hidden="true"
            width={120}
            height={120}
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={60}
              cy={60}
              r={52}
              fill="none"
              stroke="#292524"
              strokeWidth={8}
            />
            <circle
              cx={60}
              cy={60}
              r={52}
              fill="none"
              stroke={ringColor}
              strokeWidth={8}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{
                transition:
                  "stroke-dashoffset 0.55s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease",
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
                fontSize: 28,
                fontFamily: "Crimson Pro, Georgia, serif",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {completedTodayCount}/{totalScheduled}
            </span>
            <span style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>
              today
            </span>
          </div>
        </div>
      </div>

      {/* Cards panel */}
      <div
        style={{
          flex: 1,
          background: "#faf9f7",
          borderRadius: "24px 24px 0 0",
          padding: "22px 16px 8px",
        }}
      >
        {todayHabits.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "40px 0", color: "#a8a29e" }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <div
              style={{
                fontSize: 18,
                fontFamily: "Crimson Pro, Georgia, serif",
                fontWeight: 600,
                color: "#1c1917",
                marginBottom: 6,
              }}
            >
              All caught up!
            </div>
            <div style={{ fontSize: 13 }}>No habits scheduled for today.</div>
          </div>
        ) : (
          <>
            {morningHabits.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#b5b0a8",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 10,
                  }}
                >
                  Morning
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 24,
                  }}
                >
                  {morningHabits.map((habit) => (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
                      isCompleted={completionMap[habit.id] ?? false}
                      completionCount={completionCounts[habit.id] ?? 0}
                    />
                  ))}
                </div>
              </>
            )}

            {eveningHabits.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#c4bfba",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 10,
                  }}
                >
                  Tonight
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {eveningHabits.map((habit) => (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
                      isCompleted={completionMap[habit.id] ?? false}
                      completionCount={completionCounts[habit.id] ?? 0}
                      evening
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <TabBar active="today" />
    </div>
  );
}
