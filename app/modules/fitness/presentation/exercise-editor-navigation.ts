export function parseExerciseReturnTo(value: string | null): string {
  if (!value?.startsWith("/")) return "/workouts/exercises";
  try {
    const url = new URL(value, "https://fitness.invalid");
    if (
      url.origin !== "https://fitness.invalid" ||
      !/^\/workouts\/(exercises|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.test(
        url.pathname,
      )
    )
      return "/workouts/exercises";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/workouts/exercises";
  }
}

export function exerciseEditorUrl(
  exerciseId: string,
  returnTo: string,
): string {
  return `/workouts/exercises/${encodeURIComponent(exerciseId)}/edit?${new URLSearchParams({ returnTo: parseExerciseReturnTo(returnTo) })}`;
}
