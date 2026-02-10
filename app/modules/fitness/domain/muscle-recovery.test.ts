import { describe, expect, it } from "vitest";
import {
  BASE_TIME_CONSTANTS,
  BASELINE_VOLUME_LOAD,
  calculateRecovery,
  getRecoveryStatus,
  hoursUntilRecovery,
  type MuscleFatigueEvent,
  type MuscleRecoveryStatus,
  type RecoveryMap,
} from "./muscle-recovery";
import type { MuscleGroup } from "./workout";

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function findMuscle(
  map: RecoveryMap,
  muscleGroup: MuscleGroup,
): MuscleRecoveryStatus {
  const found = map.find((s) => s.muscleGroup === muscleGroup);
  if (!found) throw new Error(`Muscle ${muscleGroup} not found in map`);
  return found;
}

describe("muscle-recovery", () => {
  describe("getRecoveryStatus", () => {
    it("returns fresh for 80-100%", () => {
      expect(getRecoveryStatus(80)).toBe("fresh");
      expect(getRecoveryStatus(100)).toBe("fresh");
      expect(getRecoveryStatus(95)).toBe("fresh");
    });

    it("returns recovering for 50-79%", () => {
      expect(getRecoveryStatus(50)).toBe("recovering");
      expect(getRecoveryStatus(79)).toBe("recovering");
      expect(getRecoveryStatus(65)).toBe("recovering");
    });

    it("returns fatigued for 0-49%", () => {
      expect(getRecoveryStatus(0)).toBe("fatigued");
      expect(getRecoveryStatus(49)).toBe("fatigued");
      expect(getRecoveryStatus(25)).toBe("fatigued");
    });
  });

  describe("hoursUntilRecovery", () => {
    it("returns undefined when already at target", () => {
      expect(hoursUntilRecovery(0.1, 28, 80)).toBeUndefined();
    });

    it("returns positive hours when below target", () => {
      const hours = hoursUntilRecovery(0.5, 28, 80);
      expect(hours).toBeDefined();
      expect(hours).toBeGreaterThan(0);
    });
  });

  describe("calculateRecovery", () => {
    const now = new Date();

    it("returns 100% for all muscles when no events", () => {
      const result = calculateRecovery([], now);
      expect(result).toHaveLength(13);
      for (const status of result) {
        expect(status.recoveryPercentage).toBe(100);
        expect(status.status).toBe("fresh");
        expect(status.lastWorkoutDate).toBeUndefined();
        expect(status.hoursUntilFresh).toBeUndefined();
      }
    });

    it("shows low recovery for recently trained muscle", () => {
      const events: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD,
          workoutDate: hoursAgo(2),
        },
      ];

      const result = calculateRecovery(events, now);
      const pecs = findMuscle(result, "pecs");
      expect(pecs.recoveryPercentage).toBeLessThan(20);
      expect(pecs.status).toBe("fatigued");
      expect(pecs.lastWorkoutDate).toBeDefined();
      expect(pecs.hoursUntilFresh).toBeGreaterThan(0);
    });

    it("shows high recovery for muscle trained days ago", () => {
      const events: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD,
          workoutDate: hoursAgo(72),
        },
      ];

      const result = calculateRecovery(events, now);
      const pecs = findMuscle(result, "pecs");
      // τ=36h, at 72h: recovery = 1 - e^(-72/36) = 1 - e^(-2) ≈ 86%
      expect(pecs.recoveryPercentage).toBeGreaterThanOrEqual(85);
      expect(pecs.recoveryPercentage).toBeLessThanOrEqual(90);
      expect(pecs.status).toBe("fresh");
    });

    it("smaller muscles recover faster", () => {
      const events: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD,
          workoutDate: hoursAgo(36),
        },
        {
          muscleGroup: "biceps",
          volumeLoad: BASELINE_VOLUME_LOAD,
          workoutDate: hoursAgo(36),
        },
      ];

      const result = calculateRecovery(events, now);
      const pecs = findMuscle(result, "pecs");
      const biceps = findMuscle(result, "biceps");
      // pecs τ=36h, biceps τ=20h. At 36h:
      // pecs: 1 - e^(-1) ≈ 63%
      // biceps: 1 - e^(-36/20) ≈ 83%
      expect(biceps.recoveryPercentage).toBeGreaterThan(
        pecs.recoveryPercentage,
      );
    });

    it("heavy sessions slow recovery", () => {
      const lightEvents: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD * 0.5,
          workoutDate: hoursAgo(36),
        },
      ];

      const heavyEvents: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD * 2,
          workoutDate: hoursAgo(36),
        },
      ];

      const lightResult = calculateRecovery(lightEvents, now);
      const heavyResult = calculateRecovery(heavyEvents, now);

      const lightPecs = findMuscle(lightResult, "pecs");
      const heavyPecs = findMuscle(heavyResult, "pecs");

      expect(lightPecs.recoveryPercentage).toBeGreaterThan(
        heavyPecs.recoveryPercentage,
      );
    });

    it("stacks fatigue from multiple sessions", () => {
      const singleEvent: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD,
          workoutDate: hoursAgo(24),
        },
      ];

      const doubleEvents: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD,
          workoutDate: hoursAgo(48),
        },
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD,
          workoutDate: hoursAgo(24),
        },
      ];

      const singleResult = calculateRecovery(singleEvent, now);
      const doubleResult = calculateRecovery(doubleEvents, now);

      const singlePecs = findMuscle(singleResult, "pecs");
      const doublePecs = findMuscle(doubleResult, "pecs");

      expect(doublePecs.recoveryPercentage).toBeLessThan(
        singlePecs.recoveryPercentage,
      );
    });

    it("caps recovery at 0% minimum", () => {
      const events: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD * 3,
          workoutDate: hoursAgo(2),
        },
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD * 3,
          workoutDate: hoursAgo(4),
        },
        {
          muscleGroup: "pecs",
          volumeLoad: BASELINE_VOLUME_LOAD * 3,
          workoutDate: hoursAgo(6),
        },
      ];

      const result = calculateRecovery(events, now);
      const pecs = findMuscle(result, "pecs");
      expect(pecs.recoveryPercentage).toBe(0);
      expect(pecs.status).toBe("fatigued");
    });

    it("assigns correct categories", () => {
      const result = calculateRecovery([], now);
      const pecs = findMuscle(result, "pecs");
      const biceps = findMuscle(result, "biceps");
      const quads = findMuscle(result, "quads");
      const lats = findMuscle(result, "lats");

      expect(pecs.category).toBe("core");
      expect(biceps.category).toBe("arms");
      expect(quads.category).toBe("legs");
      expect(lats.category).toBe("back");
    });

    it("handles very light volume (floor at 0.5x tau)", () => {
      const events: MuscleFatigueEvent[] = [
        {
          muscleGroup: "pecs",
          volumeLoad: 10,
          workoutDate: hoursAgo(36),
        },
      ];

      const result = calculateRecovery(events, now);
      const pecs = findMuscle(result, "pecs");
      // With floor at 0.5x, tau_adjusted = 36 * 0.5 = 18h
      // At 36h: 1 - e^(-36/18) = 1 - e^(-2) ~ 86%
      expect(pecs.recoveryPercentage).toBeGreaterThanOrEqual(85);
    });

    it("covers all 13 muscle groups", () => {
      const result = calculateRecovery([], now);
      expect(result).toHaveLength(13);
      const groups = result.map((s) => s.muscleGroup);
      expect(groups).toContain("abs");
      expect(groups).toContain("armstrings");
      expect(groups).toContain("biceps");
      expect(groups).toContain("calves");
      expect(groups).toContain("delts");
      expect(groups).toContain("forearm");
      expect(groups).toContain("glutes");
      expect(groups).toContain("lats");
      expect(groups).toContain("lower_back");
      expect(groups).toContain("pecs");
      expect(groups).toContain("quads");
      expect(groups).toContain("trapezes");
      expect(groups).toContain("triceps");
    });

    it("has correct base time constants for all muscles", () => {
      expect(Object.keys(BASE_TIME_CONSTANTS)).toHaveLength(13);
      expect(BASE_TIME_CONSTANTS.pecs).toBe(36);
      expect(BASE_TIME_CONSTANTS.calves).toBe(16);
      expect(BASE_TIME_CONSTANTS.biceps).toBe(20);
    });
  });
});
