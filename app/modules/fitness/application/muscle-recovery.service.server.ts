import type { ResultAsync } from "neverthrow";
import type { RecoveryMap } from "~/modules/fitness/domain/muscle-recovery";
import { calculateRecovery } from "~/modules/fitness/domain/muscle-recovery";
import { MuscleRecoveryRepository } from "~/modules/fitness/infra/muscle-recovery.repository.server";
import type { ErrRepository } from "~/repository";

export const MuscleRecoveryService = {
  getRecoveryMap(): ResultAsync<RecoveryMap, ErrRepository> {
    return MuscleRecoveryRepository.getRecentFatigueEvents().map((events) =>
      calculateRecovery(events, new Date()),
    );
  },
};
