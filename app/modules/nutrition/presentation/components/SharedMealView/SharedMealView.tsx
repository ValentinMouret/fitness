import { ResetIcon } from "@radix-ui/react-icons";
import { Button, Slider } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import type {
  IngredientWithQuantity,
  NutritionalTotals,
} from "~/modules/nutrition/domain/ingredient";
import { Ingredient } from "~/modules/nutrition/domain/ingredient";
import {
  calculateSatietyScore,
  type MealCategory,
} from "~/modules/nutrition/domain/meal-template";
import { getIngredientIcon } from "../../utils/ingredient-icon";
import "./SharedMealView.css";

export interface SharedMealViewModel {
  readonly name: string;
  readonly category: MealCategory;
  readonly notes: string | null;
  readonly ingredients: readonly IngredientWithQuantity[];
}

const CATEGORY_LABELS: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const SATIETY_DOTS = [1, 2, 3, 4, 5] as const;

function CalorieRing({ calories }: { readonly calories: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  // The ring is a visual flourish anchored to a soft 800 kcal reference.
  const progress = Math.min(calories / 800, 1);

  return (
    <div className="shared-meal__ring">
      <svg aria-hidden="true" width={120} height={120}>
        <circle
          cx={60}
          cy={60}
          r={r}
          fill="none"
          stroke="#292524"
          strokeWidth={8}
        />
        <circle
          cx={60}
          cy={60}
          r={r}
          fill="none"
          stroke="var(--brand-coral)"
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.45s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </svg>
      <div className="shared-meal__ring-label">
        <span className="shared-meal__ring-value">{Math.round(calories)}</span>
        <span className="shared-meal__ring-unit">kcal</span>
      </div>
    </div>
  );
}

function MacroCard({
  value,
  label,
}: {
  readonly value: number;
  readonly label: string;
}) {
  return (
    <div className="shared-meal__macro">
      <div>
        <span className="shared-meal__macro-value">{Math.round(value)}</span>
        <span className="shared-meal__macro-unit">g</span>
      </div>
      <div className="shared-meal__macro-label">{label}</div>
    </div>
  );
}

function IngredientRow({
  item,
  quantity,
  onQuantityChange,
}: {
  readonly item: IngredientWithQuantity;
  readonly quantity: number;
  readonly onQuantityChange: (quantity: number) => void;
}) {
  const { ingredient } = item;
  const nutrition = Ingredient.calculateNutritionForQuantity(
    ingredient,
    quantity,
  );

  return (
    <div className="shared-meal__ingredient">
      <div className="shared-meal__ingredient-head">
        <span className="shared-meal__ingredient-icon">
          {getIngredientIcon(ingredient.name)}
        </span>
        <span className="shared-meal__ingredient-name">{ingredient.name}</span>
        <span className="shared-meal__ingredient-qty">{quantity}g</span>
      </div>
      <Slider
        value={[quantity]}
        onValueChange={(value: number[]) => onQuantityChange(value[0])}
        min={ingredient.sliderMin}
        max={ingredient.sliderMax}
        step={5}
        color="tomato"
        aria-label={`Adjust ${ingredient.name} quantity`}
      />
      <div className="shared-meal__ingredient-macros">
        {Math.round(nutrition.calories)} kcal • {Math.round(nutrition.protein)}g
        protein • {Math.round(nutrition.carbs)}g carbs •{" "}
        {Math.round(nutrition.fat)}g fat
      </div>
    </div>
  );
}

export function SharedMealView({
  meal,
}: {
  readonly meal: SharedMealViewModel;
}) {
  const initialQuantities = useMemo(
    () =>
      Object.fromEntries(
        meal.ingredients.map((item) => [
          item.ingredient.id,
          item.quantityGrams,
        ]),
      ),
    [meal.ingredients],
  );

  const [quantities, setQuantities] =
    useState<Record<string, number>>(initialQuantities);

  const isModified = meal.ingredients.some(
    (item) => quantities[item.ingredient.id] !== item.quantityGrams,
  );

  const { totals, satiety } = useMemo(() => {
    const scaled: readonly IngredientWithQuantity[] = meal.ingredients.map(
      (item) => ({
        ingredient: item.ingredient,
        quantityGrams: quantities[item.ingredient.id] ?? item.quantityGrams,
      }),
    );
    const computed: NutritionalTotals =
      Ingredient.calculateTotalNutrition(scaled);
    return {
      totals: computed,
      satiety: calculateSatietyScore(scaled, computed),
    };
  }, [meal.ingredients, quantities]);

  return (
    <div className="shared-meal">
      <header className="shared-meal__header">
        <div className="shared-meal__eyebrow">
          {CATEGORY_LABELS[meal.category]}
        </div>
        <h1 className="shared-meal__title">{meal.name}</h1>
        {meal.notes && <p className="shared-meal__notes">{meal.notes}</p>}
        <CalorieRing calories={totals.calories} />
        <div className="shared-meal__macros">
          <MacroCard value={totals.protein} label="Protein" />
          <MacroCard value={totals.carbs} label="Carbs" />
          <MacroCard value={totals.fat} label="Fat" />
        </div>
        <div className="shared-meal__satiety">
          <div className="shared-meal__satiety-dots" aria-hidden="true">
            {SATIETY_DOTS.map((dot) => (
              <span
                key={dot}
                className={`shared-meal__satiety-dot${dot <= satiety.level ? " is-on" : ""}`}
              />
            ))}
          </div>
          <span className="shared-meal__satiety-text">
            {satiety.description} · ~{satiety.estimatedSatisfactionHours.min}–
            {satiety.estimatedSatisfactionHours.max}h fullness
          </span>
        </div>
      </header>

      <div className="shared-meal__panel">
        <div className="shared-meal__panel-head">
          <span className="shared-meal__panel-title">
            Ingredients ({meal.ingredients.length})
          </span>
          <Button
            variant="ghost"
            size="1"
            color="gray"
            disabled={!isModified}
            onClick={() => setQuantities(initialQuantities)}
          >
            <ResetIcon /> Reset
          </Button>
        </div>

        <div className="shared-meal__ingredients">
          {meal.ingredients.map((item) => (
            <IngredientRow
              key={item.ingredient.id}
              item={item}
              quantity={quantities[item.ingredient.id] ?? item.quantityGrams}
              onQuantityChange={(quantity) =>
                setQuantities((prev) => ({
                  ...prev,
                  [item.ingredient.id]: quantity,
                }))
              }
            />
          ))}
        </div>

        <p className="shared-meal__footnote">
          Drag a slider to explore portions. This is a read-only shared meal —
          changes aren&apos;t saved.
        </p>
      </div>
    </div>
  );
}
