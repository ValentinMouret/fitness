import { Button } from "@radix-ui/themes";
import { Link } from "react-router";
import { getNutritionPageData } from "~/modules/nutrition/infra/nutrition-page.service.server";
import type { Route } from "./+types";
import "./index.css";

export async function loader() {
  return getNutritionPageData();
}

const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

const mealConfig: Record<string, { label: string; icon: string }> = {
  breakfast: { label: "Breakfast", icon: "🌅" },
  lunch: { label: "Lunch", icon: "☀️" },
  dinner: { label: "Dinner", icon: "🌙" },
  snack: { label: "Snacks", icon: "🍎" },
};

function CalorieRing({ current, target }: { current: number; target: number }) {
  const progress = Math.min(current / target, 1);
  const r = 58;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="nutrition-hero__ring">
      <svg aria-hidden="true" width={140} height={140}>
        <circle
          cx={70}
          cy={70}
          r={r}
          fill="none"
          stroke="var(--gray-4)"
          strokeWidth={7}
        />
        <circle
          cx={70}
          cy={70}
          r={r}
          fill="none"
          stroke="var(--tomato-9)"
          strokeWidth={7}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.55s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </svg>
      <div className="nutrition-hero__ring-label">
        <span className="nutrition-hero__kcal">{Math.round(current)}</span>
        <span className="nutrition-hero__kcal-unit">kcal</span>
      </div>
    </div>
  );
}

export default function NutritionPage({ loaderData }: Route.ComponentProps) {
  const { calorieTarget, dailySummary } = loaderData;
  const { dailyTotals, meals } = dailySummary;

  const caloriePercent = Math.round(
    Math.min((dailyTotals.calories / calorieTarget) * 100, 100),
  );

  const dateLabel = dailySummary.loggedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="nutrition-page">
      <div className="nutrition-hero">
        <span className="section-label">{dateLabel}</span>
        <CalorieRing current={dailyTotals.calories} target={calorieTarget} />
        <span className="nutrition-hero__target">
          {caloriePercent}% of {calorieTarget} kcal target
        </span>
      </div>

      <div className="nutrition-macros">
        {[
          { value: dailyTotals.protein, label: "Protein", unit: "g" },
          { value: dailyTotals.carbs, label: "Carbs", unit: "g" },
          { value: dailyTotals.fat, label: "Fat", unit: "g" },
        ].map((macro) => (
          <div key={macro.label} className="nutrition-macro-card">
            <div className="nutrition-macro-card__value">
              {Math.round(macro.value)}
            </div>
            <div className="nutrition-macro-card__unit">{macro.unit}</div>
            <div className="nutrition-macro-card__label">{macro.label}</div>
          </div>
        ))}
      </div>

      <div className="nutrition-meals">
        <div className="nutrition-meals__header">
          <p className="section-label">Meals</p>
        </div>
        <div className="nutrition-meals__list">
          {mealTypes.map((mealType) => {
            const meal = meals[mealType];
            const hasLogged = meal !== null;
            const { label, icon } = mealConfig[mealType];
            const ingredientNames = meal?.ingredients
              ?.map((ing) => ing.ingredient.name)
              .join(" · ");

            return (
              <Link
                key={mealType}
                to="/nutrition/meals"
                className={`nutrition-meal ${hasLogged ? "nutrition-meal--logged" : ""}`}
              >
                <span className="nutrition-meal__icon">{icon}</span>
                <div className="nutrition-meal__body">
                  <div className="nutrition-meal__name">{label}</div>
                  {hasLogged && ingredientNames ? (
                    <div className="nutrition-meal__detail">
                      {ingredientNames}
                    </div>
                  ) : !hasLogged ? (
                    <div className="nutrition-meal__detail nutrition-meal__detail--empty">
                      Tap to log
                    </div>
                  ) : null}
                </div>
                {hasLogged ? (
                  <span className="nutrition-meal__kcal">
                    {Math.round(meal.totals.calories)}
                  </span>
                ) : (
                  <span className="nutrition-meal__kcal nutrition-meal__kcal--empty">
                    —
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="nutrition-tools">
        <Button variant="outline" size="2" asChild>
          <Link to="/nutrition/meal-builder">Meal Builder</Link>
        </Button>
        <Button variant="outline" size="2" asChild>
          <Link to="/nutrition/calculate-targets">Calculate Targets</Link>
        </Button>
      </div>
    </div>
  );
}
