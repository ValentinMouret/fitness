/** A rest period between sets, in epoch milliseconds. */
export interface Rest {
  readonly startedAt: number;
  readonly durationMs: number;
  /** Identifies what started the rest, such as a completed set. */
  readonly source?: string;
}

export const REST_PRESETS = [30, 60, 90, 120, 180] as const;
export const DEFAULT_REST_SECONDS = 90;
/** Warm-up sets rest at most this long. */
export const WARMUP_REST_SECONDS = 60;
/** How long the "rest over" state stays before the timer dismisses itself. */
export const REST_OVER_DISMISS_MS = 6000;

export function remainingSeconds(rest: Rest, now: number): number {
  return Math.max(0, (rest.startedAt + rest.durationMs - now) / 1000);
}

export function elapsedFraction(rest: Rest, now: number): number {
  return Math.min(1, Math.max(0, (now - rest.startedAt) / rest.durationMs));
}

/** Adds or removes time without ending a rest that is still running. */
export function adjustRest(rest: Rest, seconds: number, now: number): Rest {
  const elapsed = now - rest.startedAt;
  return {
    ...rest,
    durationMs: Math.max(elapsed + 1000, rest.durationMs + seconds * 1000),
  };
}

/** Switches to a preset length; one already exceeded leaves a second to go. */
export function applyPreset(rest: Rest, seconds: number, now: number): Rest {
  return {
    ...rest,
    durationMs: Math.max(seconds * 1000, now - rest.startedAt + 1000),
  };
}

export function restSecondsFor(
  isWarmup: boolean,
  defaultSeconds: number,
): number {
  return isWarmup
    ? Math.min(defaultSeconds, WARMUP_REST_SECONDS)
    : defaultSeconds;
}
