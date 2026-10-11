import { z } from "zod";
import { reportedRirValues } from "~/modules/fitness/domain/workout";
import type { SetPatch } from "./active-workout.view-model";

const number = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .transform(Number);
const clearable = <T extends z.ZodTypeAny>(value: T) =>
  z.union([z.literal("").transform(() => null), value]).optional();
const flag = z.enum(["true", "false"]).transform((value) => value === "true");

const pendingForm = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("update-set"),
    exerciseId: z.string(),
    setNumber: number,
    reps: clearable(number),
    weight: clearable(number),
    reportedRir: clearable(z.enum(reportedRirValues)),
    isCompleted: flag.optional(),
    isWarmup: flag.optional(),
  }),
  z.object({
    intent: z.literal("complete-set"),
    exerciseId: z.string(),
    setNumber: number,
  }),
  z.object({
    intent: z.literal("remove-set"),
    exerciseId: z.string(),
    setNumber: number,
  }),
]);

/** Reads an in-flight set submission so the UI can show it immediately. */
export function pendingSetPatch(
  formData: FormData | undefined,
): SetPatch | undefined {
  if (!formData) return undefined;
  const parsed = pendingForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return undefined;
  const { intent, ...patch } = parsed.data;
  if (intent === "remove-set") return { ...patch, removed: true };
  if (intent === "complete-set") return { ...patch, isCompleted: true };
  return patch;
}
