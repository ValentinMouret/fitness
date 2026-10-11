import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { BottomSheet } from "~/components/BottomSheet";
import {
  type ExerciseOptionViewModel,
  formatLastPerformed,
} from "../../view-models/exercise-option.view-model";
import { ExerciseTypeBadge } from "../ExerciseTypeBadge";
import "./ExercisePickerSheet.css";

interface ExercisePickerSheetProps {
  readonly open: boolean;
  readonly title: string;
  readonly options: ReadonlyArray<ExerciseOptionViewModel>;
  readonly onPick: (exerciseId: string) => void;
  readonly onClose: () => void;
}

/** Searchable list of catalogue exercises. */
export function ExercisePickerSheet({
  open,
  title,
  options,
  onPick,
  onClose,
}: ExercisePickerSheetProps) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  const needle = query.trim().toLowerCase();
  const matches = options.filter((option) =>
    option.name.toLowerCase().includes(needle),
  );

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      tall
      closable
    >
      <label className="exercise-picker__search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercises"
          aria-label="Search exercises"
        />
      </label>
      <ul className="exercise-picker__list">
        {matches.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className="exercise-picker__option"
              onClick={() => onPick(option.id)}
            >
              <span className="exercise-picker__text">
                <span className="exercise-picker__name">{option.name}</span>
                <span className="exercise-picker__last">
                  {formatLastPerformed(option.lastPerformedAt)}
                </span>
              </span>
              <ExerciseTypeBadge type={option.type} />
              <Plus size={20} className="exercise-picker__plus" />
            </button>
          </li>
        ))}
      </ul>
      {matches.length === 0 && (
        <p className="exercise-picker__empty">
          No exercises match “{query.trim()}”.
        </p>
      )}
    </BottomSheet>
  );
}
