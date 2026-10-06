import { Progress } from "@radix-ui/themes";
import "./NutritionSummary.css";

interface Nutrients {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
}
interface Props {
  readonly totals: Nutrients;
  readonly targets: Nutrients;
}
const percentage = (current: number, target: number) =>
  target > 0 ? Math.min(Math.max((current / target) * 100, 0), 100) : 0;

export function NutritionSummary({ totals, targets }: Props) {
  return (
    <section className="nutrition-summary" aria-label="Daily nutrition summary">
      <span className="nutrition-summary__eyebrow">Calories</span>
      <strong>
        {Math.round(totals.calories)} <small>kcal</small>
      </strong>
      <p>
        {targets.calories > 0
          ? `${Math.round(percentage(totals.calories, targets.calories))}% of ${targets.calories} kcal target`
          : `${targets.calories} kcal target`}
      </p>
      <Progress
        value={percentage(totals.calories, targets.calories)}
        aria-label="Calories progress"
        aria-valuetext={`${Math.round(totals.calories)} of ${targets.calories} kcal`}
      />
      <div className="nutrition-macros">
        {(
          [
            { key: "protein", label: "Protein" },
            { key: "carbs", label: "Carbs" },
            { key: "fat", label: "Fat" },
          ] as const
        ).map(({ key, label }) => (
          <div key={key} className="nutrition-macro-card">
            <div className="nutrition-macro-card__value">
              {Math.round(totals[key])}
              <small> g</small>
            </div>
            <div className="nutrition-macro-card__label">{label}</div>
            <p className="nutrition-macro-card__target">
              of {targets[key]} g target
            </p>
            <Progress
              value={percentage(totals[key], targets[key])}
              aria-label={`${label} progress`}
              aria-valuetext={`${Math.round(totals[key])}g of ${targets[key]}g ${label.toLowerCase()}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
