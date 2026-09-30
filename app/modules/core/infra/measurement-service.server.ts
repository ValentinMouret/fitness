import { ok, type ResultAsync } from "neverthrow";
import type { UserId } from "~/modules/auth/domain/user";
import type { ErrRepository } from "~/repository";
import { addOneDay, isSameDay, removeOneDay, today } from "~/time";
import type { Target } from "../domain/target";
import { createMeasureRepository } from "./measure.repository.server";
import { createTargetRepository } from "./target.repository.server";

export function createMeasurementService(userId: UserId) {
  const MeasureRepository = createMeasureRepository(userId);
  return {
    fetchStreak(measurementName: string): ResultAsync<number, ErrRepository> {
      const thisDay = today();

      const loggedYesterday = MeasureRepository.fetchBetween(
        measurementName,
        removeOneDay(thisDay),
        addOneDay(thisDay),
      );

      return loggedYesterday.andThen((measureRecords) => {
        // No data logged yesterday: streak over
        if (measureRecords.length === 0) return ok(0);

        return MeasureRepository.fetchAll(measurementName).andThen(
          (measures) => {
            let streak = 1;
            let lastDay = measures[0].t;
            for (const measure of measures.slice(1)) {
              if (!isSameDay(measure.t, removeOneDay(lastDay))) {
                break;
              }
              streak++;
              lastDay = measure.t;
            }
            return ok(streak);
          },
        );
      });
    },
  };
}

export function createTargetService(userId: UserId) {
  const TargetRepository = createTargetRepository(userId);
  return {
    currentTargets(): ResultAsync<readonly Target[], ErrRepository> {
      return TargetRepository.listAllActive();
    },

    setTarget(target: Target): ResultAsync<Target, ErrRepository> {
      return TargetRepository.set(target);
    },
  };
}
