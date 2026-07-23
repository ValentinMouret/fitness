import { useCallback, useEffect, useId, useRef, useState } from "react";
import { data, Link, redirect, useNavigate } from "react-router";
import { Box, Tooltip } from "@radix-ui/themes";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { createHabit } from "~/modules/habits/infra/create-habit.service.server";
import { getOrdinalSuffix } from "~/time";
import {
  formOptionalText,
  formRepeatableText,
  formText,
} from "~/utils/form-data";
import type { Route } from "./+types/new";

const STEPS = [
  { q: "What's the habit?", short: "Name" },
  { q: "Who does this make you?", short: "Identity" },
  { q: "When will you do it?", short: "Schedule" },
  { q: "Your safety net", short: "Safety" },
  { q: "Make it yours", short: "Color" },
] as const;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MAP: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};
const COLORS = [
  "#e15a46",
  "#f59e0b",
  "#6366f1",
  "#22c55e",
  "#ec4899",
  "#0ea5e9",
];

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

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const schema = zfd.formData({
    name: formText(z.string().min(1)),
    identityPhrase: formOptionalText(),
    timeOfDay: formOptionalText(),
    location: formOptionalText(),
    isKeystone: formOptionalText(),
    minimalVersion: formOptionalText(),
    color: formText(z.string().default("#e15a46")),
    freqMode: formText(z.enum(["daily", "weekly", "monthly"])),
    daysOfWeek: formRepeatableText(),
    dayOfMonth: formOptionalText(),
  });

  const parsed = schema.parse(formData);
  const frequencyType = parsed.freqMode;
  const frequencyConfig =
    parsed.freqMode === "weekly"
      ? { days_of_week: parsed.daysOfWeek }
      : parsed.freqMode === "monthly"
        ? {
            day_of_month: parsed.dayOfMonth
              ? Number(parsed.dayOfMonth)
              : new Date().getDate(),
          }
        : {};

  const result = await createHabit({
    name: parsed.name,
    identityPhrase: parsed.identityPhrase ?? "",
    timeOfDay: parsed.timeOfDay ?? "",
    location: parsed.location ?? "",
    isKeystone: parsed.isKeystone === "on",
    minimalVersion: parsed.minimalVersion ?? "",
    color: parsed.color,
    frequencyType,
    frequencyConfig,
  });

  if (!result.ok) {
    return data({ error: result.error }, { status: result.status });
  }

  return redirect("/habits");
}

export default function NewHabit() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"forward" | "back">("forward");

  // Unique IDs for semantic label association
  const nameInputId = useId();
  const identityInputId = useId();
  const timeInputId = useId();
  const locationInputId = useId();
  const minimalVersionInputId = useId();

  // Step-specific refs for auto-focusing
  const nameInputRef = useRef<HTMLInputElement>(null);
  const identityInputRef = useRef<HTMLTextAreaElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const minimalVersionInputRef = useRef<HTMLTextAreaElement>(null);

  const [animKey, setAnimKey] = useState(0);

  const [name, setName] = useState("");
  const [identityPhrase, setIdentityPhrase] = useState("");
  const [freqMode, setFreqMode] = useState<"daily" | "weekly" | "monthly">(
    "daily",
  );
  const [selectedDays, setSelectedDays] = useState(new Set(DAYS));
  const [dayOfMonth, setDayOfMonth] = useState(new Date().getDate());
  const [timeOfDay, setTimeOfDay] = useState("");
  const [location, setLocation] = useState("");
  const [minimalVersion, setMinimalVersion] = useState("");
  const [isKeystone, setIsKeystone] = useState(false);
  const [color, setColor] = useState(COLORS[0]);

  const formRef = useRef<HTMLFormElement>(null);

  // Auto-focusing active step inputs
  useEffect(() => {
    if (step === 0) {
      nameInputRef.current?.focus();
    } else if (step === 1) {
      identityInputRef.current?.focus();
    } else if (step === 2) {
      if (freqMode !== "monthly" && timeInputRef.current) {
        timeInputRef.current.focus();
      } else {
        locationInputRef.current?.focus();
      }
    } else if (step === 3) {
      minimalVersionInputRef.current?.focus();
    }
  }, [step, freqMode]);

  const go = useCallback(
    (n: number) => {
      if (n < 0 || n > 4) return;
      setDir(n > step ? "forward" : "back");
      setAnimKey((k) => k + 1);
      setStep(n);
    },
    [step],
  );

  // Global keydown keyboard navigation (Enter/Cmd+Enter to advance, Escape to go back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Cmd+Enter or Ctrl+Enter even if modifier is pressed
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          // Continue to enter logic
        } else {
          return;
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (step > 0) {
          go(step - 1);
        } else {
          navigate("/habits");
        }
        return;
      }

      if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        const isButton = target.tagName === "BUTTON";
        const isLink = target.tagName === "A" || target.closest("a") !== null;

        if (isButton || isLink) {
          return;
        }

        const isTextarea = target.tagName === "TEXTAREA";

        // Require Cmd/Ctrl + Enter in textareas to allow standard line breaks
        if (isTextarea && !e.ctrlKey && !e.metaKey) {
          return;
        }

        if (step === 0 && name.trim() === "") {
          return;
        }

        e.preventDefault();
        if (step === 4) {
          formRef.current?.requestSubmit();
        } else {
          go(step + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, name, navigate, go]);

  function toggleDay(d: string) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  const actualDays = [...selectedDays].map((d) => DAY_MAP[d]);

  function getNextTooltipContent() {
    if (step === 4) return "Add habit (Enter)";
    if (step === 1 || step === 3)
      return `Next: ${STEPS[step + 1].short} (Cmd+Enter)`;
    return `Next: ${STEPS[step + 1].short} (Enter)`;
  }

  function renderStep() {
    if (step === 0) {
      return (
        <div style={{ padding: "24px 24px 0" }}>
          <label
            htmlFor={nameInputId}
            style={{ ...fieldLabel, display: "block" }}
          >
            Name
          </label>
          <input
            id={nameInputId}
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Run"
            style={fieldInput}
            required
          />
        </div>
      );
    }

    if (step === 1) {
      return (
        <div style={{ padding: "24px 24px 0" }}>
          <label
            htmlFor={identityInputId}
            style={{ ...fieldLabel, display: "block" }}
          >
            Identity phrase
          </label>
          <textarea
            id={identityInputId}
            ref={identityInputRef}
            value={identityPhrase}
            onChange={(e) => setIdentityPhrase(e.target.value)}
            placeholder='Start with "I am…"'
            rows={4}
            style={{ ...fieldInput, resize: "none", lineHeight: 1.7 }}
          />
        </div>
      );
    }

    if (step === 2) {
      return (
        <div style={{ padding: "24px 24px 0" }}>
          <div style={fieldLabel}>Frequency</div>
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 24,
              background: "#f0ede8",
              borderRadius: 12,
              padding: 4,
            }}
          >
            {(["daily", "weekly", "monthly"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFreqMode(mode)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  background: freqMode === mode ? "#fff" : "transparent",
                  color: freqMode === mode ? "#1c1917" : "#79756d",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow:
                    freqMode === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  textTransform: "capitalize",
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          {freqMode === "weekly" && (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 24,
              }}
            >
              {DAYS.map((d) => {
                const sel = selectedDays.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600,
                      background: sel ? "#e15a46" : "#f0ede8",
                      color: sel ? "#fff" : "#79756d",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
          {freqMode === "monthly" && (
            <div style={{ marginBottom: 24 }}>
              <div style={fieldLabel}>Day of month</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDayOfMonth(d)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      background: dayOfMonth === d ? "#e15a46" : "#f0ede8",
                      color: dayOfMonth === d ? "#fff" : "#79756d",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          {freqMode !== "monthly" && (
            <>
              <label
                htmlFor={timeInputId}
                style={{ ...fieldLabel, display: "block" }}
              >
                Time
              </label>
              <input
                id={timeInputId}
                ref={timeInputRef}
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                type="time"
                style={{ ...fieldInput, marginBottom: 20 }}
              />
            </>
          )}
          <label
            htmlFor={locationInputId}
            style={{ ...fieldLabel, display: "block" }}
          >
            Location
          </label>
          <input
            id={locationInputId}
            ref={locationInputRef}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Home, Gym"
            style={fieldInput}
          />
        </div>
      );
    }

    if (step === 3) {
      return (
        <div style={{ padding: "24px 24px 0" }}>
          <label
            htmlFor={minimalVersionInputId}
            style={{ ...fieldLabel, display: "block" }}
          >
            Minimum version
          </label>
          <textarea
            id={minimalVersionInputId}
            ref={minimalVersionInputRef}
            value={minimalVersion}
            onChange={(e) => setMinimalVersion(e.target.value)}
            placeholder="e.g. Just put on your shoes"
            rows={3}
            style={{
              ...fieldInput,
              resize: "none",
              lineHeight: 1.7,
              marginBottom: 28,
            }}
          />
          <button
            type="button"
            role="switch"
            aria-checked={isKeystone}
            onClick={() => setIsKeystone(!isKeystone)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              width: "100%",
            }}
          >
            <div
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                background: isKeystone ? "#e15a46" : "#e7e5e4",
                position: "relative",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: isKeystone ? undefined : 3,
                  right: isKeystone ? 3 : undefined,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s, right 0.2s",
                }}
              />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1917" }}>
                Keystone habit
              </div>
              <div style={{ fontSize: 12, color: "#a8a29e", marginTop: 2 }}>
                Triggers a cascade of other good behaviours
              </div>
            </div>
          </button>
        </div>
      );
    }

    if (step === 4) {
      return (
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
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: c,
                  flexShrink: 0,
                  border: "none",
                  cursor: "pointer",
                  boxShadow:
                    c === color ? `0 0 0 3px #faf9f7, 0 0 0 5px ${c}` : "none",
                }}
              />
            ))}
          </div>
          <div
            style={{
              background: "#f0ede8",
              borderRadius: 14,
              padding: 16,
            }}
          >
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
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1c1917" }}>
                {name || "Habit name"}
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
              {identityPhrase || "Identity phrase"}
            </div>
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              {freqMode === "monthly" ? (
                <span
                  style={{
                    fontSize: 11,
                    background: "#e7e5e4",
                    borderRadius: 8,
                    padding: "2px 8px",
                    color: "#79756d",
                  }}
                >
                  Every {getOrdinalSuffix(dayOfMonth)}
                </span>
              ) : freqMode === "daily" ? (
                <span
                  style={{
                    fontSize: 11,
                    background: "#e7e5e4",
                    borderRadius: 8,
                    padding: "2px 8px",
                    color: "#79756d",
                  }}
                >
                  Every day
                </span>
              ) : (
                [...selectedDays].map((d) => (
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
                ))
              )}
              {timeOfDay && (
                <span style={{ fontSize: 11, color: "#a8a29e", marginLeft: 4 }}>
                  · {timeOfDay}
                </span>
              )}
            </div>
            {location && (
              <div style={{ fontSize: 12, color: "#a8a29e" }}>{location}</div>
            )}
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        fontFamily: "DM Sans, system-ui, sans-serif",
      }}
    >
      <style>{STYLES}</style>

      <div
        style={{
          background: "#1c1917",
          padding: "44px 24px 20px",
          minHeight: 172,
        }}
      >
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
        <Tooltip content="Cancel and go back (Esc)">
          <Box display="inline-block">
            <Link
              to="/habits"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#6b6560",
                textDecoration: "none",
              }}
            >
              ← Cancel
            </Link>
          </Box>
        </Tooltip>
      </div>

      <div
        style={{
          flex: 1,
          background: "#faf9f7",
          borderRadius: "24px 24px 0 0",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div
          key={animKey}
          className={dir === "forward" ? "enter-right" : "enter-left"}
        >
          {renderStep()}
        </div>
      </div>

      {/* Hidden form submitted on step 5 */}
      <form ref={formRef} method="post" style={{ display: "none" }}>
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="identityPhrase" value={identityPhrase} />
        <input type="hidden" name="timeOfDay" value={timeOfDay} />
        <input type="hidden" name="location" value={location} />
        {isKeystone && <input type="hidden" name="isKeystone" value="on" />}
        <input type="hidden" name="minimalVersion" value={minimalVersion} />
        <input type="hidden" name="color" value={color} />
        <input type="hidden" name="freqMode" value={freqMode} />
        {freqMode === "weekly" &&
          actualDays.map((d) => (
            <input key={d} type="hidden" name="daysOfWeek" value={d} />
          ))}
        {freqMode === "monthly" && (
          <input type="hidden" name="dayOfMonth" value={dayOfMonth} />
        )}
        <button type="submit" />
      </form>

      <div
        style={{
          background: "#1c1917",
          padding: "16px 24px 32px",
          display: "flex",
          gap: 12,
        }}
      >
        <Tooltip
          content={
            step > 0 ? "Previous step (Esc)" : "Cancel and go back (Esc)"
          }
        >
          <Box display="inline-block" style={{ flex: 1 }}>
            <button
              type="button"
              onClick={() => {
                if (step > 0) {
                  go(step - 1);
                } else {
                  navigate("/habits");
                }
              }}
              style={{
                width: "100%",
                padding: "13px 0",
                border: "1px solid #3d3935",
                borderRadius: 12,
                background: "transparent",
                color: "#a8a29e",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {step > 0 ? `← ${STEPS[step - 1].short}` : "Back"}
            </button>
          </Box>
        </Tooltip>

        <Tooltip content={getNextTooltipContent()}>
          <Box display="inline-block" style={{ flex: 2 }}>
            <button
              type="button"
              disabled={step === 0 && name.trim() === ""}
              onClick={() => {
                if (step === 4) {
                  formRef.current?.requestSubmit();
                } else {
                  go(step + 1);
                }
              }}
              style={{
                width: "100%",
                padding: "13px 0",
                border: "none",
                borderRadius: 12,
                background:
                  step === 0 && name.trim() === "" ? "#c4bfba" : "#e15a46",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  step === 0 && name.trim() === "" ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {step === 4 ? "Add habit" : `${STEPS[step + 1].short} →`}
            </button>
          </Box>
        </Tooltip>
      </div>
    </div>
  );
}
