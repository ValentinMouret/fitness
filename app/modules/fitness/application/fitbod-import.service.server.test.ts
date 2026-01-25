import { describe, expect, test } from "vitest";
import { validateFitbodCSV } from "./fitbod-import.service.server";

describe("Fitbod Import Service", () => {
  describe("validateFitbodCSV", () => {
    test("validates correct CSV format", () => {
      const validCSV = `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
2026-01-22 06:54:26 +0000,Dumbbell Bench Press,8,16.0,0.0,0.0,0.0,0.0,true,,2.0
2026-01-22 06:55:00 +0000,Dumbbell Bench Press,10,20.0,0.0,0.0,0.0,0.0,false,,2.0`;

      const result = validateFitbodCSV(validCSV);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe(true);
    });

    test("rejects empty content", () => {
      const result = validateFitbodCSV("");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe("CSV content is empty");
    });

    test("rejects CSV with only header", () => {
      const result = validateFitbodCSV(
        "Date,Exercise,Reps,Weight(kg),Duration(s)",
      );
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(
        "CSV must have a header row and at least one data row",
      );
    });

    test("rejects CSV missing required headers", () => {
      const csvMissingReps = `Date,Exercise,Weight(kg),Duration(s)
2026-01-22 06:54:26 +0000,Dumbbell Bench Press,16.0,0.0`;

      const result = validateFitbodCSV(csvMissingReps);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe("Missing required header: Reps");
    });

    test("rejects CSV missing Date header", () => {
      const csvMissingDate = `Exercise,Reps,Weight(kg),Duration(s)
Dumbbell Bench Press,8,16.0,0.0`;

      const result = validateFitbodCSV(csvMissingDate);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe("Missing required header: Date");
    });

    test("rejects whitespace-only content", () => {
      const result = validateFitbodCSV("   \n   \t   ");
      expect(result.isErr()).toBe(true);
    });
  });
});
