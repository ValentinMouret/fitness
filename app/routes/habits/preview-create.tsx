import { useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = [
  "#e15a46",
  "#f59e0b",
  "#6366f1",
  "#22c55e",
  "#ec4899",
  "#0ea5e9",
];

const MOCK_NAME = "Morning Run";
const MOCK_IDENTITY = "I am a runner who starts the day with movement";
const MOCK_DAYS = new Set(["Mon", "Wed", "Fri"]);
const MOCK_TIME = "07:00";
const MOCK_LOCATION = "Parc de la Tête d'Or";
const MOCK_COLOR = "#e15a46";
const MOCK_MINIMAL = "Put on running shoes and walk 10 minutes";

const STYLES = `
  @keyframes slideInFromRight {
    from { opacity: 0; transform: translateX(32px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInFromLeft {
    from { opacity: 0; transform: translateX(-32px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .enter-right { animation: slideInFromRight 0.28s cubic-bezier(0.4,0,0.2,1) forwards; }
  .enter-left  { animation: slideInFromLeft  0.28s cubic-bezier(0.4,0,0.2,1) forwards; }
`;

// ── A: The Stepper ────────────────────────────────────────────────────────────

const STEPS = [
  { q: "What's the habit?", short: "Name" },
  { q: "Who does this make you?", short: "Identity" },
  { q: "When will you do it?", short: "Schedule" },
  { q: "Your safety net", short: "Safety" },
  { q: "Make it yours", short: "Color" },
];

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#a8a29e",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 10,
  fontWeight: 600,
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderBottom: "1px solid #e7e5e4",
  outline: "none",
  fontSize: 16,
  color: "#1c1917",
  background: "transparent",
  paddingBottom: 8,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function AStep({ step }: { step: number }) {
  return (
    <div>
      {step === 0 && (
        <div style={{ padding: "24px 24px 0" }}>
          <div style={fieldLabel}>Name</div>
          <input
            defaultValue={MOCK_NAME}
            placeholder="e.g. Morning Run"
            style={fieldInput}
          />
        </div>
      )}

      {step === 1 && (
        <div style={{ padding: "24px 24px 0" }}>
          <div style={fieldLabel}>Identity phrase</div>
          <textarea
            defaultValue={MOCK_IDENTITY}
            placeholder='Start with "I am…"'
            rows={4}
            style={{ ...fieldInput, resize: "none", lineHeight: 1.7 }}
          />
        </div>
      )}

      {step === 2 && (
        <div style={{ padding: "24px 24px 0" }}>
          <div style={fieldLabel}>Days</div>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            {DAYS.map((d) => {
              const sel = MOCK_DAYS.has(d);
              return (
                <div
                  key={d}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    background: sel ? "#e15a46" : "#f0ede8",
                    color: sel ? "#fff" : "#79756d",
                  }}
                >
                  {d}
                </div>
              );
            })}
          </div>
          <div style={fieldLabel}>Time</div>
          <input
            defaultValue={MOCK_TIME}
            type="time"
            style={{ ...fieldInput, marginBottom: 20 }}
          />
          <div style={fieldLabel}>Location</div>
          <input defaultValue={MOCK_LOCATION} style={fieldInput} />
        </div>
      )}

      {step === 3 && (
        <div style={{ padding: "24px 24px 0" }}>
          <div style={fieldLabel}>Minimum version</div>
          <textarea
            defaultValue={MOCK_MINIMAL}
            rows={3}
            style={{
              ...fieldInput,
              resize: "none",
              lineHeight: 1.7,
              marginBottom: 28,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                background: "#e15a46",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1917" }}>
                Keystone habit
              </div>
              <div style={{ fontSize: 12, color: "#a8a29e", marginTop: 2 }}>
                Triggers a cascade of other good behaviours
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ padding: "24px 24px 0" }}>
          <div style={fieldLabel}>Colour</div>
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "4px 0",
              marginBottom: 24,
            }}
          >
            {COLORS.map((c) => (
              <div
                key={c}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: c,
                  flexShrink: 0,
                  boxShadow:
                    c === MOCK_COLOR
                      ? `0 0 0 3px #faf9f7, 0 0 0 5px ${c}`
                      : "none",
                }}
              />
            ))}
          </div>
          <div style={{ background: "#f0ede8", borderRadius: 14, padding: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: MOCK_COLOR,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1c1917" }}>
                {MOCK_NAME}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#6b6560",
                fontStyle: "italic",
                lineHeight: 1.5,
                marginBottom: 10,
              }}
            >
              {MOCK_IDENTITY}
            </div>
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              {[...MOCK_DAYS].map((d) => (
                <span
                  key={d}
                  style={{
                    fontSize: 11,
                    background: "#e7e5e4",
                    borderRadius: 8,
                    padding: "2px 8px",
                    color: "#79756d",
                  }}
                >
                  {d}
                </span>
              ))}
              <span style={{ fontSize: 11, color: "#a8a29e", marginLeft: 4 }}>
                · {MOCK_TIME}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#a8a29e" }}>
              {MOCK_LOCATION}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DirectionA() {
  const [step, setStep] = useState(2);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);

  function go(n: number) {
    if (n < 0 || n > 4) return;
    setDir(n > step ? "forward" : "back");
    setAnimKey((k) => k + 1);
    setStep(n);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        fontFamily: "DM Sans, system-ui, sans-serif",
      }}
    >
      <div style={{ background: "#1c1917", padding: "44px 24px 20px" }}>
        <div
          style={{
            fontSize: 11,
            color: "#6b6560",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Step {step + 1} of {STEPS.length}
        </div>
        <div
          style={{
            fontSize: 26,
            fontFamily: "Crimson Pro, Georgia, serif",
            fontWeight: 600,
            color: "#faf9f7",
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          {STEPS[step].q}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          background: "#faf9f7",
          borderRadius: "24px 24px 0 0",
          overflowY: "auto",
        }}
      >
        <div
          key={animKey}
          className={dir === "forward" ? "enter-right" : "enter-left"}
        >
          <AStep step={step} />
        </div>
      </div>

      <div
        style={{
          background: "#1c1917",
          padding: "16px 24px 32px",
          display: "flex",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          style={{
            flex: 1,
            padding: "13px 0",
            border: "1px solid #3d3935",
            borderRadius: 12,
            background: "transparent",
            color: step === 0 ? "#3d3935" : "#a8a29e",
            fontSize: 13,
            fontWeight: 500,
            cursor: step === 0 ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {step > 0 ? `← ${STEPS[step - 1].short}` : "Back"}
        </button>
        <button
          type="button"
          onClick={() => go(step + 1)}
          style={{
            flex: 2,
            padding: "13px 0",
            border: "none",
            borderRadius: 12,
            background: "#e15a46",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {step === 4 ? "Add habit" : `${STEPS[step + 1].short} →`}
        </button>
      </div>
    </div>
  );
}

// ── B: The Manifesto (identity-first, single scroll) ──────────────────────────

function DirectionB() {
  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#fff",
        minHeight: "100%",
      }}
    >
      <div style={{ background: "#1c1917", padding: "44px 24px 24px" }}>
        <div
          style={{
            fontSize: 11,
            color: "#6b6560",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}
        >
          New habit
        </div>
        <div
          style={{
            fontSize: 22,
            fontFamily: "Crimson Pro, Georgia, serif",
            fontWeight: 600,
            color: "#faf9f7",
          }}
        >
          Write it down. Make it real.
        </div>
      </div>

      <div style={{ padding: "32px 24px 40px" }}>
        {/* Identity — the hero */}
        <div
          style={{
            borderLeft: "3px solid #e15a46",
            paddingLeft: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#e15a46",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Who you're becoming
          </div>
          <textarea
            defaultValue={MOCK_IDENTITY}
            rows={3}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              fontSize: 20,
              fontFamily: "Crimson Pro, Georgia, serif",
              fontStyle: "italic",
              color: "#1c1917",
              background: "transparent",
              resize: "none",
              lineHeight: 1.5,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Name */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              color: "#a8a29e",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            The habit
          </div>
          <input
            defaultValue={MOCK_NAME}
            style={{
              width: "100%",
              border: "none",
              borderBottom: "1px solid #e7e5e4",
              outline: "none",
              fontSize: 18,
              fontWeight: 700,
              color: "#1c1917",
              background: "transparent",
              paddingBottom: 10,
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Schedule */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              color: "#a8a29e",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            Schedule
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {DAYS.map((d) => {
              const sel = MOCK_DAYS.has(d);
              return (
                <div
                  key={d}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    background: sel ? "#1c1917" : "#f5f4f2",
                    color: sel ? "#fff" : "#79756d",
                  }}
                >
                  {d}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <input
              defaultValue={MOCK_TIME}
              type="time"
              style={{
                border: "none",
                borderBottom: "1px solid #e7e5e4",
                outline: "none",
                fontSize: 16,
                color: "#1c1917",
                background: "transparent",
                paddingBottom: 6,
              }}
            />
            <input
              defaultValue={MOCK_LOCATION}
              style={{
                flex: 1,
                border: "none",
                borderBottom: "1px solid #e7e5e4",
                outline: "none",
                fontSize: 16,
                color: "#1c1917",
                background: "transparent",
                paddingBottom: 6,
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Colour */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontSize: 11,
              color: "#a8a29e",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            Colour
          </div>
          <div style={{ display: "flex", gap: 10, padding: "4px 0" }}>
            {COLORS.map((c) => (
              <div
                key={c}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: c,
                  flexShrink: 0,
                  boxShadow:
                    c === MOCK_COLOR
                      ? `0 0 0 3px #fff, 0 0 0 5px ${c}`
                      : "none",
                }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          style={{
            width: "100%",
            padding: "16px 0",
            background: "#1c1917",
            color: "#faf9f7",
            border: "none",
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Add habit
        </button>
      </div>
    </div>
  );
}

// ── C: The Coach (conversational) ─────────────────────────────────────────────

function CoachBubble({
  text,
  isActive = false,
}: {
  text: string;
  isActive?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        marginBottom: isActive ? 4 : 16,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#e15a46",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "#fff",
        }}
      >
        ⚡
      </div>
      <div
        style={{
          background: isActive ? "#fff" : "#f5f4f2",
          borderRadius: "4px 16px 16px 16px",
          padding: "10px 14px",
          fontSize: 14,
          color: "#1c1917",
          lineHeight: 1.5,
          maxWidth: "85%",
          border: isActive ? "1px solid #e7e5e4" : "none",
          boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div
      style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}
    >
      <div
        style={{
          background: "#e15a46",
          borderRadius: "16px 16px 4px 16px",
          padding: "10px 14px",
          fontSize: 14,
          color: "#fff",
          lineHeight: 1.5,
          maxWidth: "80%",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function DirectionC() {
  const [selectedDays, setSelectedDays] = useState(new Set(MOCK_DAYS));

  function toggleDay(d: string) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#faf9f7",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ background: "#1c1917", padding: "44px 20px 16px" }}>
        <div
          style={{
            fontSize: 11,
            color: "#6b6560",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          New habit
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 16px 0", overflowY: "auto" }}>
        <CoachBubble text="What habit do you want to build?" />
        <UserBubble text={MOCK_NAME} />
        <CoachBubble text={`Nice. Who does "${MOCK_NAME}" make you?`} />
        <UserBubble text={MOCK_IDENTITY} />
        <CoachBubble text="When will you do it?" isActive />

        {/* Inline schedule picker */}
        <div style={{ paddingLeft: 38, marginTop: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {DAYS.map((d) => {
              const sel = selectedDays.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: sel ? "none" : "1px solid #e7e5e4",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: sel ? "#e15a46" : "#fff",
                    color: sel ? "#fff" : "#79756d",
                    flexShrink: 0,
                    fontFamily: "inherit",
                  }}
                >
                  {d[0]}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              defaultValue={MOCK_TIME}
              type="time"
              style={{
                border: "1px solid #e7e5e4",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 14,
                color: "#1c1917",
                background: "#fff",
                outline: "none",
              }}
            />
            <input
              defaultValue={MOCK_LOCATION}
              placeholder="Location"
              style={{
                flex: 1,
                border: "1px solid #e7e5e4",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 14,
                color: "#1c1917",
                background: "#fff",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 32px" }}>
        <button
          type="button"
          style={{
            width: "100%",
            padding: "14px 0",
            background: "#e15a46",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Preview wrapper ───────────────────────────────────────────────────────────

const DESIGNS = [
  {
    label: "A — The Stepper",
    tagline: "5 steps, clearly numbered. One question at a time.",
    component: <DirectionA />,
  },
  {
    label: "B — The Manifesto",
    tagline: "Identity first. Single scroll. Who you're becoming leads.",
    component: <DirectionB />,
  },
  {
    label: "C — The Coach",
    tagline: "Conversational. Answers build into a transcript.",
    component: <DirectionC />,
  },
];

export default function HabitsPreviewCreate() {
  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#f8f7f5",
        minHeight: "100vh",
        padding: "40px 48px",
      }}
    >
      <style>{STYLES}</style>

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
          Create Habit — 3 UX Directions
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
