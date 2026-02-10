import { WorkoutSessionRepository } from "~/modules/fitness/infra/workout.repository.server";
import type { Route } from "./+types/history";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const exerciseId = url.searchParams.get("exerciseId");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "10", 10);

  if (!exerciseId) {
    return Response.json({ error: "exerciseId is required" }, { status: 400 });
  }

  const result = await WorkoutSessionRepository.getExerciseHistory(
    exerciseId,
    cursor,
    limit,
  );

  if (result.isErr()) {
    return Response.json(
      { error: "Failed to load exercise history" },
      { status: 500 },
    );
  }

  return Response.json(result.value);
}
