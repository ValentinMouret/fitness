import { MuscleRecoveryService } from "~/modules/fitness/application/muscle-recovery.service.server";
import { MuscleRecoveryMap } from "~/modules/fitness/presentation/components";
import { createRecoveryViewModels } from "~/modules/fitness/presentation/view-models/muscle-recovery.view-model";
import type { Route } from "./+types/recovery";

export const loader = async () => {
  const result = await MuscleRecoveryService.getRecoveryMap();
  if (result.isErr()) {
    throw new Response("Failed to load recovery data", { status: 500 });
  }
  return { recoveryMap: result.value };
};

export const handle = {
  header: () => ({
    title: "Muscle Recovery",
    subtitle: "Recovery status",
  }),
};

export default function MuscleRecoveryPage({
  loaderData,
}: Route.ComponentProps) {
  const viewModels = createRecoveryViewModels(loaderData.recoveryMap);

  return <MuscleRecoveryMap viewModels={viewModels} />;
}
