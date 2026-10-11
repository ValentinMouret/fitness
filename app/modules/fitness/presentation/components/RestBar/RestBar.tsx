import { Check, ChevronDown, Clock } from "lucide-react";
import { useState } from "react";
import { ProgressRing } from "~/components/ProgressRing";
import { formatClock } from "~/time";
import { useNow } from "../../hooks/useNow";
import type { RestTimer } from "../../hooks/useRestTimer";
import type { Rest } from "../../rest-timer/rest-timer";
import {
  elapsedFraction,
  REST_PRESETS,
  remainingSeconds,
} from "../../rest-timer/rest-timer";
import { NotificationToggle } from "./NotificationToggle";
import "./RestBar.css";

interface RestBarProps {
  readonly timer: RestTimer;
}

/** Floating rest countdown; tap it to reveal presets. */
export function RestBar({ timer }: RestBarProps) {
  return timer.rest ? <RunningRest timer={timer} rest={timer.rest} /> : null;
}

function RunningRest({ timer, rest }: RestBarProps & { readonly rest: Rest }) {
  const [expanded, setExpanded] = useState(false);
  const now = useNow(250);

  const left = Math.ceil(remainingSeconds(rest, now));
  const isOver = left <= 0;
  const isExpanded = expanded && !isOver;
  const className = [
    "rest-bar",
    isOver && "rest-bar--over",
    isExpanded && "rest-bar--expanded",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={className} aria-label="Rest timer">
      {isExpanded ? (
        <>
          <div className="rest-bar__top">
            <NotificationToggle />
            <button
              type="button"
              className="rest-bar__icon"
              onClick={() => setExpanded(false)}
              aria-label="Collapse rest timer"
            >
              <ChevronDown size={18} />
            </button>
          </div>
          <div className="rest-bar__big" role="timer" aria-live="off">
            {formatClock(left)}
          </div>
          <div className="rest-bar__presets">
            {REST_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={
                  Math.round(rest.durationMs / 1000) === preset
                    ? "rest-bar__preset rest-bar__preset--on"
                    : "rest-bar__preset"
                }
                aria-pressed={Math.round(rest.durationMs / 1000) === preset}
                onClick={() => timer.choosePreset(preset)}
              >
                {formatClock(preset)}
              </button>
            ))}
          </div>
          <div className="rest-bar__actions">
            <button
              type="button"
              className="rest-bar__pill"
              onClick={() => timer.adjust(-15)}
            >
              −15s
            </button>
            <button
              type="button"
              className="rest-bar__pill"
              onClick={() => timer.adjust(15)}
            >
              +15s
            </button>
            <button
              type="button"
              className="rest-bar__pill rest-bar__pill--light"
              onClick={timer.dismiss}
            >
              Skip
            </button>
          </div>
        </>
      ) : (
        <div className="rest-bar__row">
          <button
            type="button"
            className="rest-bar__summary"
            onClick={() => setExpanded(true)}
            disabled={isOver}
            aria-label={isOver ? undefined : "Show rest presets"}
          >
            <span className="rest-bar__ring">
              <ProgressRing
                value={isOver ? 1 : elapsedFraction(rest, now)}
                size={44}
                stroke={4}
              />
              {isOver ? <Check size={18} /> : <Clock size={18} />}
            </span>
            <span className="rest-bar__time" role={isOver ? "status" : "timer"}>
              {isOver ? "Rest over" : formatClock(left)}
            </span>
          </button>
          {!isOver && (
            <>
              <button
                type="button"
                className="rest-bar__pill"
                onClick={() => timer.adjust(-15)}
                aria-label="Remove 15 seconds"
              >
                −15
              </button>
              <button
                type="button"
                className="rest-bar__pill"
                onClick={() => timer.adjust(15)}
                aria-label="Add 15 seconds"
              >
                +15
              </button>
            </>
          )}
          <button
            type="button"
            className="rest-bar__pill"
            onClick={timer.dismiss}
          >
            {isOver ? "OK" : "Skip"}
          </button>
        </div>
      )}
    </section>
  );
}
