import { useState } from "react";

type MockHabit = {
  id: string;
  name: string;
  identityPhrase: string;
  scheduledDays: string[];
  timeOfDay: string;
  location: string;
  isKeystone: boolean;
  minimalVersion: string;
  color: string;
  completionCount: number;
  scheduledToday: boolean;
};

const MOCK_HABITS: MockHabit[] = [
  {
    id: "1",
    name: "Morning Run",
    identityPhrase: "I am a runner who starts the day with movement",
    scheduledDays: ["Monday", "Wednesday", "Friday"],
    timeOfDay: "07:00",
    location: "Parc de la Tête d'Or",
    isKeystone: true,
    minimalVersion: "Put on running shoes and walk 10 minutes",
    color: "#e15a46",
    completionCount: 47,
    scheduledToday: true,
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
    minimalVersion: "Take supplements without weighing",
    color: "#f59e0b",
    completionCount: 89,
    scheduledToday: true,
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
    minimalVersion: "Read one page",
    color: "#6366f1",
    completionCount: 34,
    scheduledToday: true,
  },
  {
    id: "4",
    name: "Gym",
    identityPhrase: "I am someone who shows up and builds strength",
    scheduledDays: ["Tuesday", "Thursday", "Saturday"],
    timeOfDay: "18:00",
    location: "Fitness Park",
    isKeystone: false,
    minimalVersion: "Put on gym clothes and drive there",
    color: "#22c55e",
    completionCount: 127,
    scheduledToday: false,
  },
];

function isMorning(timeOfDay: string) {
  return parseInt(timeOfDay.split(":")[0]) < 12;
}

// 14-day history
function fakeHistory(habit: MockHabit): boolean[] {
  const days: boolean[] = [];
  for (let i = 0; i < 14; i++) {
    days.push(Math.random() > 0.28);
  }
  if (habit.id === "3") {
    days[0] = false;
    days[1] = false;
    days[2] = false;
  }
  if (habit.id === "4") days[0] = false;
  return days;
}

const HISTORIES: Record<string, boolean[]> = Object.fromEntries(
  MOCK_HABITS.map((h) => [h.id, fakeHistory(h)]),
);

// ─── Design A (interactive) ───────────────────────────────────────────────────

const DESIGN_A_STYLES = `
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
  @keyframes particleOut {
    0%   { opacity: 1; transform: translate(0, 0) scale(1); }
    100% { opacity: 0; transform: var(--target) scale(0); }
  }
  .check-pop {
    animation: checkPop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .heading-in {
    animation: headingIn 0.35s ease forwards;
  }
  .ring-bounce {
    animation: ringBounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .sub-in {
    animation: subIn 0.4s ease 0.18s both;
  }
  .particle {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: particleOut 0.7s ease-out forwards;
  }
  .habit-card-a {
    transition: border-left-color 0.3s ease, box-shadow 0.3s ease;
  }
  .habit-name-a {
    transition: color 0.25s ease, text-decoration-color 0.25s ease;
  }
`;

const PARTICLE_SLOTS: { x: number; y: number; color: string }[] = [
  { x: 0, y: -62, color: "#e15a46" },
  { x: 44, y: -44, color: "#f59e0b" },
  { x: 62, y: 0, color: "#22c55e" },
  { x: 44, y: 44, color: "#6366f1" },
  { x: 0, y: 62, color: "#e15a46" },
  { x: -44, y: 44, color: "#f59e0b" },
  { x: -62, y: 0, color: "#22c55e" },
  { x: -44, y: -44, color: "#6366f1" },
];

function DesignA() {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [minimumIds, setMinimumIds] = useState<Set<string>>(new Set());
  const [popId, setPopId] = useState<string | null>(null);
  const [ringKey, setRingKey] = useState(0);
  const [headingKey, setHeadingKey] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [celebKey, setCelebKey] = useState(0);

  const scheduledToday = MOCK_HABITS.filter((h) => h.scheduledToday);
  const morningHabits = scheduledToday.filter((h) => isMorning(h.timeOfDay));
  const eveningHabits = scheduledToday.filter((h) => !isMorning(h.timeOfDay));

  const totalDone = scheduledToday.filter((h) => completedIds.has(h.id)).length;
  const totalScheduled = scheduledToday.length;
  const allMorningDone = morningHabits.every((h) => completedIds.has(h.id));

  const progress = totalDone / totalScheduled;
  const circumference = 2 * Math.PI * 52;

  function complete(habitId: string, isMinimum = false) {
    const wasAlreadyDone = completedIds.has(habitId);
    if (wasAlreadyDone) return;

    const next = new Set(completedIds);
    next.add(habitId);
    if (isMinimum) setMinimumIds((prev) => new Set([...prev, habitId]));
    setCompletedIds(next);

    setPopId(habitId);
    setTimeout(() => setPopId(null), 500);

    const nowMorningDone = morningHabits.every((h) => next.has(h.id));
    if (nowMorningDone && !allMorningDone) {
      setTimeout(() => {
        setRingKey((k) => k + 1);
        setHeadingKey((k) => k + 1);
        setCelebrating(true);
        setCelebKey((k) => k + 1);
        setTimeout(() => setCelebrating(false), 900);
      }, 200);
    }
  }

  function uncomplete(habitId: string) {
    const next = new Set(completedIds);
    next.delete(habitId);
    setMinimumIds((prev) => {
      const m = new Set(prev);
      m.delete(habitId);
      return m;
    });
    setCompletedIds(next);
    if (allMorningDone) setHeadingKey((k) => k + 1);
  }

  function handleCardTap(habit: MockHabit) {
    if (completedIds.has(habit.id)) {
      uncomplete(habit.id);
    } else {
      complete(habit.id);
    }
  }

  const ringColor = allMorningDone ? "#22c55e" : "#e15a46";

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
      {/* Header */}
      <div style={{ padding: "44px 24px 18px", color: "#faf9f7" }}>
        <div
          style={{
            fontSize: 13,
            color: "#a8a29e",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Saturday, March 14
        </div>
        <div
          key={headingKey}
          className="heading-in"
          style={{
            fontSize: 28,
            fontFamily: "Crimson Pro, Georgia, serif",
            fontWeight: 600,
          }}
        >
          {allMorningDone ? "Morning done. You showed up." : "Good morning."}
        </div>
        {allMorningDone && (
          <div
            className="sub-in"
            style={{ fontSize: 13, color: "#a8a29e", marginTop: 5 }}
          >
            Read is up tonight at 21:30.
          </div>
        )}
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
          key={ringKey}
          className={allMorningDone ? "ring-bounce" : ""}
          style={{ position: "relative", width: 120, height: 120 }}
        >
          {/* Celebration particles */}
          {celebrating &&
            PARTICLE_SLOTS.map((p, i) => (
              <div
                key={`${celebKey}-${i}`}
                className="particle"
                style={
                  {
                    top: "50%",
                    left: "50%",
                    marginTop: -4,
                    marginLeft: -4,
                    background: p.color,
                    "--target": `translate(${p.x}px, ${p.y}px)`,
                    animationDelay: `${i * 30}ms`,
                  } as React.CSSProperties
                }
              />
            ))}

          <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
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
              {totalDone}/{totalScheduled}
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
          padding: "22px 16px 32px",
        }}
      >
        {/* Morning */}
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
          {morningHabits.map((habit) => {
            const done = completedIds.has(habit.id);
            const isMin = minimumIds.has(habit.id);
            return (
              <div
                key={habit.id}
                className="habit-card-a"
                onClick={() => handleCardTap(habit)}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  borderLeft: `4px solid ${done ? habit.color : "#e7e5e4"}`,
                  boxShadow: done
                    ? `0 2px 10px ${habit.color}22`
                    : "0 1px 3px rgba(0,0,0,0.06)",
                  cursor: "pointer",
                  overflow: "hidden",
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
                  {/* Check circle */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      flexShrink: 0,
                      marginTop: 2,
                      background: done ? habit.color : "transparent",
                      border: `2px solid ${done ? habit.color : "#d6d3d1"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition:
                        "background 0.2s ease, border-color 0.2s ease",
                    }}
                  >
                    {done && (
                      <svg
                        key={habit.id}
                        className={popId === habit.id ? "check-pop" : ""}
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
                      {habit.isKeystone && (
                        <span style={{ fontSize: 13 }}>⚡</span>
                      )}
                      <span
                        className="habit-name-a"
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: done ? "#a8a29e" : "#1c1917",
                          textDecoration: done ? "line-through" : "none",
                        }}
                      >
                        {habit.name}
                      </span>
                      {isMin && (
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
                          color: done ? habit.color : "#c4bfba",
                        }}
                      >
                        {habit.completionCount + (done ? 1 : 0)}
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

                {/* Log minimum — only shown when incomplete */}
                {!done && (
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
                      onClick={(e) => {
                        e.stopPropagation();
                        complete(habit.id, true);
                      }}
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
          })}
        </div>

        {/* Tonight */}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {eveningHabits.map((habit) => {
                const done = completedIds.has(habit.id);
                return (
                  <div
                    key={habit.id}
                    className="habit-card-a"
                    onClick={() => handleCardTap(habit)}
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      borderLeft: `4px solid ${done ? habit.color : "#f0ede8"}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      opacity: done ? 1 : 0.55,
                      cursor: "pointer",
                      overflow: "hidden",
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
                          background: done ? habit.color : "transparent",
                          border: done
                            ? `2px solid ${habit.color}`
                            : "2px dashed #d6d3d1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background 0.2s ease, border 0.2s ease",
                        }}
                      >
                        {done && (
                          <svg
                            key={`ev-${habit.id}`}
                            className={popId === habit.id ? "check-pop" : ""}
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
                            fontSize: 15,
                            fontWeight: 600,
                            color: done ? "#a8a29e" : "#a8a29e",
                            marginBottom: 2,
                            textDecoration: done ? "line-through" : "none",
                          }}
                        >
                          {habit.name}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#c4bfba",
                            lineHeight: 1.4,
                            marginBottom: 4,
                          }}
                        >
                          {habit.identityPhrase}
                        </div>
                        <div style={{ fontSize: 11, color: "#d6d3d1" }}>
                          <span
                            style={{
                              fontFamily: "Crimson Pro, Georgia, serif",
                              fontSize: 13,
                              fontWeight: 700,
                              color: done ? habit.color : "#d6d3d1",
                            }}
                          >
                            {habit.completionCount + (done ? 1 : 0)}
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
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Reset */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <button
            type="button"
            onClick={() => {
              setCompletedIds(new Set());
              setMinimumIds(new Set());
              setHeadingKey((k) => k + 1);
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

// ─── Design B ────────────────────────────────────────────────────────────────

function DesignB() {
  const scheduledToday = MOCK_HABITS.filter((h) => h.scheduledToday);
  const morning = scheduledToday.filter((h) => isMorning(h.timeOfDay));
  const evening = scheduledToday.filter((h) => !isMorning(h.timeOfDay));

  const initialCompleted = new Set(["1", "2"]);
  const [completedIds] = useState(initialCompleted);

  const HabitCard = ({ habit }: { habit: MockHabit }) => {
    const done = completedIds.has(habit.id);
    return (
      <div
        style={{
          background: "#fff",
          border: `1px solid ${done ? habit.color + "40" : "#f0ede8"}`,
          borderRadius: 16,
          padding: "16px",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: done ? habit.color : "transparent",
              border: `2px solid ${done ? habit.color : "#d6d3d1"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 4,
            }}
          >
            {done && (
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8l3.5 3.5 6.5-7"
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
                fontSize: 11,
                color: "#b5b0a8",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              {habit.name}
            </div>
            <div
              style={{
                fontSize: 17,
                fontFamily: "Crimson Pro, Georgia, serif",
                fontWeight: 600,
                color: done ? "#a8a29e" : "#1c1917",
                lineHeight: 1.3,
                marginBottom: 8,
                textDecoration: done ? "line-through" : "none",
              }}
            >
              {habit.identityPhrase}
            </div>
            <div style={{ fontSize: 13, color: "#a8a29e" }}>
              <span
                style={{
                  fontFamily: "Crimson Pro, Georgia, serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: habit.color,
                }}
              >
                {habit.completionCount}
              </span>{" "}
              votes cast
            </div>
          </div>
        </div>
        {!done && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid #f0ede8",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, color: "#b5b0a8" }}>
              Struggling today?
            </span>
            <div
              style={{
                background: "#faf9f7",
                border: "1px solid #e7e5e4",
                borderRadius: 20,
                padding: "5px 12px",
                fontSize: 11,
                color: "#79756d",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>Log minimum</span>
              <span style={{ color: "#b5b0a8" }}>→</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#b5b0a8",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#e7e5e4" }} />
    </div>
  );

  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#faf9f7",
        minHeight: "100%",
        padding: "48px 16px 24px",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 12,
            color: "#a8a29e",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Saturday · March 14
        </div>
        <div
          style={{
            fontSize: 26,
            fontFamily: "Crimson Pro, Georgia, serif",
            fontWeight: 600,
            color: "#1c1917",
          }}
        >
          Morning.
        </div>
      </div>
      <div style={{ marginBottom: 28 }}>
        <SectionLabel label="Morning" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {morning.map((h) => (
            <HabitCard key={h.id} habit={h} />
          ))}
        </div>
      </div>
      {evening.length > 0 && (
        <div>
          <SectionLabel label="Tonight" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {evening.map((h) => (
              <HabitCard key={h.id} habit={h} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Design C ────────────────────────────────────────────────────────────────

function HeatmapStrip({ habit }: { habit: MockHabit }) {
  const history = HISTORIES[habit.id];
  const scheduledPerWeek = habit.scheduledDays.length;
  const rawHits = history.slice(0, 7).filter(Boolean).length;
  const weekHits = Math.min(rawHits, scheduledPerWeek);
  const missedTwice = habit.id === "3";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #ede9e3",
        borderRadius: 12,
        borderLeft: `4px solid ${habit.color}`,
        padding: "12px 14px",
        opacity: habit.scheduledToday ? 1 : 0.45,
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
          <span>Never miss twice — 3 days missed. Tonight counts.</span>
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
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1917" }}>
            {habit.name}
          </div>
          <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 1 }}>
            {habit.timeOfDay} · {habit.location}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: weekHits === scheduledPerWeek ? "#22c55e" : habit.color,
            }}
          >
            {weekHits}/{scheduledPerWeek}
          </div>
          <div style={{ fontSize: 10, color: "#b5b0a8" }}>this week</div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(14, 1fr)",
          gap: 3,
          marginBottom: 4,
        }}
      >
        {history.map((completed, i) => (
          <div
            key={i}
            style={{
              height: 14,
              borderRadius: 3,
              background: completed ? habit.color : "#f0ede8",
              opacity: i === 0 ? 1 : 0.55 + (i / 14) * 0.45,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#c4bfba" }}>13 days ago</span>
        <span style={{ fontSize: 10, color: "#c4bfba" }}>today</span>
      </div>
      {habit.scheduledToday && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid #f0ede8",
            display: "flex",
            gap: 8,
          }}
        >
          <button
            type="button"
            style={{
              flex: 1,
              background: habit.color,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Mark done
          </button>
          <button
            type="button"
            style={{
              background: "#faf9f7",
              color: "#79756d",
              border: "1px solid #e7e5e4",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Minimum →
          </button>
        </div>
      )}
    </div>
  );
}

function DesignC() {
  const scheduledToday = MOCK_HABITS.filter((h) => h.scheduledToday);
  const totalScheduledPerWeek = MOCK_HABITS.reduce(
    (acc, h) => acc + h.scheduledDays.length,
    0,
  );
  const totalHitsThisWeek = MOCK_HABITS.reduce((acc, h) => {
    const rawHits = HISTORIES[h.id].slice(0, 7).filter(Boolean).length;
    return acc + Math.min(rawHits, h.scheduledDays.length);
  }, 0);

  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#f7f4ef",
        minHeight: "100%",
        padding: "48px 16px 24px",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 12,
            color: "#a8a29e",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Saturday · March 14
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
          padding: "14px 16px",
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
          <span style={{ fontSize: 13, color: "#79756d" }}>This week</span>
          <span
            style={{
              fontSize: 15,
              fontFamily: "Crimson Pro, Georgia, serif",
              fontWeight: 700,
              color: "#1c1917",
            }}
          >
            {totalHitsThisWeek}/{totalScheduledPerWeek}
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
              width: `${(totalHitsThisWeek / totalScheduledPerWeek) * 100}%`,
              background: "#e15a46",
              borderRadius: 3,
            }}
          />
        </div>
      </div>
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
        Today
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {scheduledToday.map((habit) => (
          <HeatmapStrip key={habit.id} habit={habit} />
        ))}
      </div>
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
        Not today
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_HABITS.filter((h) => !h.scheduledToday).map((habit) => (
          <HeatmapStrip key={habit.id} habit={habit} />
        ))}
      </div>
    </div>
  );
}

// ─── Preview wrapper ──────────────────────────────────────────────────────────

const DESIGNS = [
  {
    label: "A — Decisive Morning",
    tagline: "Interactive. Tap cards to complete. Try 'Log minimum'.",
    component: <DesignA />,
  },
  {
    label: "B — Identity Stack",
    tagline: "Habits as identity votes. Who you're becoming.",
    component: <DesignB />,
  },
  {
    label: "C — Heatmap Focus",
    tagline: "Consistency evidence. The Plateau of Latent Potential visible.",
    component: <DesignC />,
  },
];

export default function HabitsPreview() {
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
          Habits Design Exploration · 3 concepts
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
