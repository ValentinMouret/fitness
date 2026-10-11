import {
  draftForSet,
  type SetDraft,
  type SnapshotSet,
} from "./ActiveWorkoutSet";
export type PendingDraft = Readonly<{
  values: SetDraft;
  baseline: SetDraft;
  revision: string;
}>;
export const mergeDraft = (
  draft: PendingDraft | undefined,
  set: SnapshotSet,
): SetDraft => {
  const fresh = draftForSet(set);
  if (!draft) return fresh;
  return {
    reps:
      draft.values.reps !== draft.baseline.reps
        ? draft.values.reps
        : fresh.reps,
    weight:
      draft.values.weight !== draft.baseline.weight
        ? draft.values.weight
        : fresh.weight,
    reportedRir:
      draft.values.reportedRir !== draft.baseline.reportedRir
        ? draft.values.reportedRir
        : fresh.reportedRir,
  };
};
