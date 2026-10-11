import { describe, expect, it } from "vitest";
import {
  adjustRest,
  applyPreset,
  elapsedFraction,
  remainingSeconds,
  restSecondsFor,
} from "./rest-timer";

const rest = { startedAt: 0, durationMs: 90_000 };

describe("rest timer", () => {
  it("counts down and never goes below zero", () => {
    expect(remainingSeconds(rest, 30_000)).toBe(60);
    expect(remainingSeconds(rest, 120_000)).toBe(0);
  });

  it("reports progress through the rest", () => {
    expect(elapsedFraction(rest, 45_000)).toBe(0.5);
    expect(elapsedFraction(rest, 200_000)).toBe(1);
  });

  it("adds and removes time", () => {
    expect(adjustRest(rest, 15, 0).durationMs).toBe(105_000);
    expect(adjustRest(rest, -15, 0).durationMs).toBe(75_000);
  });

  it("keeps a second left when removing more time than remains", () => {
    expect(remainingSeconds(adjustRest(rest, -15, 85_000), 85_000)).toBe(1);
  });

  it("switches to a preset unless it has already elapsed", () => {
    expect(applyPreset(rest, 120, 10_000).durationMs).toBe(120_000);
    expect(remainingSeconds(applyPreset(rest, 30, 40_000), 40_000)).toBe(1);
  });

  it("caps warm-up rest at a minute", () => {
    expect(restSecondsFor(true, 150)).toBe(60);
    expect(restSecondsFor(true, 45)).toBe(45);
    expect(restSecondsFor(false, 150)).toBe(150);
  });
});
