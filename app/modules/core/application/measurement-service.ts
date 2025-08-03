import { type ResultAsync, ok } from "neverthrow";
import type { ErrRepository } from "~/repository";
import { addOneDay, isSameDay, removeOneDay, today } from "~/time";
import { MeasureRepository } from "../infra/measure.repository.server";
import { TargetRepository } from "../infra/repository";
import type { Target } from "../domain/target";

export const MeasurementService = {
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

      return MeasureRepository.fetchAll(measurementName).andThen((measures) => {
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
      });
    });
  },
};

export const TargetService = {
  currentTargets(): ResultAsync<readonly Target[], ErrRepository> {
    return TargetRepository.listAllActive();
  },

  setTarget(target: Target): ResultAsync<Target, ErrRepository> {
    return TargetRepository.unsetTargetsByName(target.measurement).andThen(() =>
      TargetRepository.save(target),
    );
  },
};
