import { useState } from "react";
import { useFetcher } from "react-router";

interface WorkoutNameProps {
  readonly name: string;
  readonly actionPath: string;
}

/** The workout title; tap it to rename the workout. */
export function WorkoutName({ name, actionPath }: WorkoutNameProps) {
  const fetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(false);
  const shownName = fetcher.formData?.get("name")?.toString() ?? name;

  const save = (value: string) => {
    setIsEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== name)
      fetcher.submit(
        { intent: "update-name", name: trimmed },
        { method: "post", action: actionPath },
      );
  };

  if (isEditing)
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: the input replaces the tapped title.
        autoFocus
        className="active-workout__name-input"
        aria-label="Workout name"
        defaultValue={shownName}
        maxLength={200}
        onBlur={(event) => save(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setIsEditing(false);
        }}
      />
    );

  return (
    <h1 className="active-workout__name">
      <button
        type="button"
        className="active-workout__name-button"
        title="Rename workout"
        onClick={() => setIsEditing(true)}
      >
        {shownName}
      </button>
    </h1>
  );
}
