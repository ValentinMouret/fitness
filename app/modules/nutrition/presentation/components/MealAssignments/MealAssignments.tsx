import {
  type MealCategory,
  mealCategories,
} from "~/modules/nutrition/domain/meal-template";
import "./MealAssignments.css";

export const mealLabels: Readonly<Record<MealCategory, string>> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export function MealAssignments({
  selected,
  onChange,
}: {
  readonly selected: readonly MealCategory[];
  readonly onChange: (values: readonly MealCategory[]) => void;
}) {
  return (
    <fieldset className="meal-assignments">
      <legend>Use for</legend>
      {mealCategories.map((category) => (
        <label key={category}>
          <input
            type="checkbox"
            name="mealTimes"
            value={category}
            checked={selected.includes(category)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, category]
                  : selected.filter((value) => value !== category),
              )
            }
          />
          {mealLabels[category]}
        </label>
      ))}
    </fieldset>
  );
}
