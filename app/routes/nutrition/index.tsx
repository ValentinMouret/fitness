import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DotsHorizontalIcon,
  MagicWandIcon,
  Pencil1Icon,
  PlusIcon,
} from "@radix-ui/react-icons";
import {
  AlertDialog,
  Box,
  Button,
  Card,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  IconButton,
  Progress,
  RadioGroup,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import {
  type ActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  useFetcher,
  useSearchParams,
} from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import type { MealLogWithNutrition } from "~/modules/nutrition/domain/meal-log";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";
import {
  applyMealTemplate,
  deleteMealLog,
  getMealsPageData,
  saveMealAsTemplate,
} from "~/modules/nutrition/infra/meals-page.service.server";
import {
  createTemplateSelectionViewModel,
  QuickEstimateModal,
  TemplateSelectionModal,
} from "~/modules/nutrition/presentation";
import { addOneDay, removeOneDay, toDateString, today } from "~/time";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types";
import "./index.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const currentDate = dateParam ? new Date(dateParam) : today();
  return getMealsPageData(currentDate);
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intentSchema = zfd.formData({
    intent: formOptionalText(),
  });
  const intentParsed = intentSchema.parse(formData);
  const intent = intentParsed.intent;

  if (intent === "apply-template") {
    const schema = zfd.formData({
      templateId: formText(z.string().min(1)),
      mealCategory: formText(z.enum(["breakfast", "lunch", "dinner", "snack"])),
      loggedDate: formText(z.string().min(1)),
    });
    const parsed = schema.parse(formData);
    const loggedDate = new Date(parsed.loggedDate);

    const result = await applyMealTemplate({
      templateId: parsed.templateId,
      mealCategory: parsed.mealCategory,
      loggedDate,
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  if (intent === "delete-meal") {
    const schema = zfd.formData({
      mealId: formText(z.string().min(1)),
    });
    const parsed = schema.parse(formData);

    const result = await deleteMealLog({ mealId: parsed.mealId });

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  if (intent === "save-as-template") {
    const schema = zfd.formData({
      mealId: formText(z.string().min(1)),
      name: formText(z.string().min(1)),
      category: formText(z.enum(["breakfast", "lunch", "dinner", "snack"])),
      notes: formOptionalText(),
    });
    const parsed = schema.parse(formData);

    const result = await saveMealAsTemplate({
      mealId: parsed.mealId,
      name: parsed.name,
      category: parsed.category,
      notes: parsed.notes ?? undefined,
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  return { success: false, error: "Unknown intent" };
}

const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

const mealConfig: Record<string, { label: string; icon: string }> = {
  breakfast: { label: "Breakfast", icon: "🌅" },
  lunch: { label: "Lunch", icon: "☀️" },
  dinner: { label: "Dinner", icon: "🌙" },
  snack: { label: "Snacks", icon: "🍎" },
};

interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const defaultTargets: DailyTargets = {
  calories: 2100,
  protein: 140,
  carbs: 220,
  fat: 85,
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

function formatDateLabel(date: Date): string {
  const isToday = date.toDateString() === today().toDateString();
  if (isToday) return "Today";

  const yesterday = removeOneDay(today());
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function NutritionPage({ loaderData }: Route.ComponentProps) {
  const { mealTemplates, dailySummary, targets, currentDate } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [currentMealType, setCurrentMealType] = useState<MealCategory | null>(
    null,
  );
  const [saveAsTemplateMeal, setSaveAsTemplateMeal] = useState<{
    id: string;
    category: MealCategory;
  } | null>(null);
  const [showQuickEstimate, setShowQuickEstimate] = useState(false);
  const fetcher = useFetcher();

  const templateSelectionViewModel = currentMealType
    ? createTemplateSelectionViewModel(currentMealType, mealTemplates)
    : null;

  const parsedCurrentDate = new Date(currentDate);
  const dailyTotals = dailySummary.dailyTotals;
  const dailyTargets = targets ?? defaultTargets;

  const navigateToDate = (newDate: Date) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("date", toDateString(newDate));
    setSearchParams(newParams);
  };

  const previousDay = () => navigateToDate(removeOneDay(parsedCurrentDate));
  const nextDay = () => navigateToDate(addOneDay(parsedCurrentDate));

  const getMealForType = (mealType: MealCategory) => {
    return dailySummary.meals[mealType];
  };

  const getMealBuilderUrl = (
    mealType: MealCategory,
    meal?: MealLogWithNutrition | null,
  ) => {
    const returnTo = `/nutrition?date=${toDateString(parsedCurrentDate)}`;
    const baseUrl = `/nutrition/meal-builder?meal=${mealType}&date=${toDateString(parsedCurrentDate)}&returnTo=${encodeURIComponent(returnTo)}`;

    if (meal) {
      return `${baseUrl}&mealId=${meal.id}`;
    }
    return baseUrl;
  };

  const handleClearMeal = (mealType: MealCategory) => {
    const meal = getMealForType(mealType);
    if (meal) {
      fetcher.submit(
        { intent: "delete-meal", mealId: meal.id },
        { method: "post" },
      );
    }
  };

  const handleUseTemplate = (mealType: MealCategory) => {
    setCurrentMealType(mealType);
    setShowTemplateModal(true);
  };

  const handleApplyTemplate = (templateId: string) => {
    if (currentMealType) {
      fetcher.submit(
        {
          intent: "apply-template",
          templateId,
          mealCategory: currentMealType,
          loggedDate: currentDate,
        },
        { method: "post" },
      );
      setShowTemplateModal(false);
      setCurrentMealType(null);
    }
  };

  const caloriePercent = Math.round(
    Math.min((dailyTotals.calories / dailyTargets.calories) * 100, 100),
  );

  return (
    <div className="nutrition-page">
      {/* Date Navigation */}
      <div className="nutrition-date-nav">
        <IconButton
          variant="ghost"
          onClick={previousDay}
          aria-label="Previous day"
        >
          <ChevronLeftIcon width="16" height="16" />
        </IconButton>
        <Heading size="5">{formatDateLabel(parsedCurrentDate)}</Heading>
        <IconButton variant="ghost" onClick={nextDay} aria-label="Next day">
          <ChevronRightIcon width="16" height="16" />
        </IconButton>
      </div>

      {/* Hero */}
      <div className="nutrition-hero">
        <CalorieRing
          current={dailyTotals.calories}
          target={dailyTargets.calories}
        />
        <span className="nutrition-hero__target">
          {caloriePercent}% of {dailyTargets.calories} kcal target
        </span>
      </div>

      {/* Macros */}
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

      {/* Daily Progress Bars */}
      <Card size="3" mb="4" className="nutrition-progress-card">
        <Grid columns="2" gap="3">
          <Box>
            <Flex justify="between" mb="1">
              <Text size="1">Calories</Text>
              <Text size="1" weight="medium">
                {Math.round(dailyTotals.calories)} / {dailyTargets.calories}
              </Text>
            </Flex>
            <Progress
              value={(dailyTotals.calories / dailyTargets.calories) * 100}
            />
          </Box>
          <Box>
            <Flex justify="between" mb="1">
              <Text size="1">Protein</Text>
              <Text size="1" weight="medium">
                {Math.round(dailyTotals.protein)}g / {dailyTargets.protein}g
              </Text>
            </Flex>
            <Progress
              value={(dailyTotals.protein / dailyTargets.protein) * 100}
            />
          </Box>
          <Box>
            <Flex justify="between" mb="1">
              <Text size="1">Carbs</Text>
              <Text size="1" weight="medium">
                {Math.round(dailyTotals.carbs)}g / {dailyTargets.carbs}g
              </Text>
            </Flex>
            <Progress value={(dailyTotals.carbs / dailyTargets.carbs) * 100} />
          </Box>
          <Box>
            <Flex justify="between" mb="1">
              <Text size="1">Fat</Text>
              <Text size="1" weight="medium">
                {Math.round(dailyTotals.fat)}g / {dailyTargets.fat}g
              </Text>
            </Flex>
            <Progress value={(dailyTotals.fat / dailyTargets.fat) * 100} />
          </Box>
        </Grid>
      </Card>

      {/* Meals */}
      <div className="nutrition-meals">
        <div className="nutrition-meals__header">
          <p className="section-label">Meals</p>
          <Button
            variant="soft"
            size="1"
            onClick={() => setShowQuickEstimate(true)}
          >
            <MagicWandIcon />
            Estimate
          </Button>
        </div>
        <div className="nutrition-meals__list">
          {mealTypes.map((mealType) => {
            const meal = getMealForType(mealType);
            const hasLogged = meal !== null;
            const { label, icon } = mealConfig[mealType];
            const ingredientNames = meal?.ingredients
              ?.map((ing) => ing.ingredient.name)
              .join(" · ");

            const isDeleting =
              fetcher.state !== "idle" &&
              fetcher.formData?.get("intent") === "delete-meal" &&
              fetcher.formData?.get("mealId") === meal?.id;

            const isApplyingTemplate =
              fetcher.state !== "idle" &&
              fetcher.formData?.get("intent") === "apply-template" &&
              fetcher.formData?.get("mealCategory") === mealType;

            return (
              <div
                key={mealType}
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
                <div className="nutrition-meal__actions">
                  {hasLogged ? (
                    <>
                      <span className="nutrition-meal__kcal">
                        {Math.round(meal.totals.calories)}
                      </span>
                      <Button
                        size="1"
                        variant="outline"
                        aria-label={`Edit ${label}`}
                        asChild
                      >
                        <Link to={getMealBuilderUrl(mealType, meal)}>
                          <Pencil1Icon width="14" height="14" />
                          Edit
                        </Link>
                      </Button>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                          <Button
                            variant="ghost"
                            size="1"
                            aria-label={`More actions for ${label}`}
                            loading={isDeleting}
                          >
                            <DotsHorizontalIcon width="14" height="14" />
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item
                            onClick={() =>
                              setSaveAsTemplateMeal({
                                id: meal.id,
                                category: mealType,
                              })
                            }
                          >
                            Save as Template
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            color="red"
                            onClick={() => handleClearMeal(mealType)}
                          >
                            Clear Meal
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </>
                  ) : (
                    <>
                      <span className="nutrition-meal__kcal nutrition-meal__kcal--empty">
                        —
                      </span>
                      <Button
                        size="1"
                        variant="outline"
                        aria-label={`Add ${label}`}
                        asChild
                      >
                        <Link to={getMealBuilderUrl(mealType)}>
                          <PlusIcon width="14" height="14" />
                          Add
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="1"
                        onClick={() => handleUseTemplate(mealType)}
                        aria-label={`Use template for ${label}`}
                        loading={isApplyingTemplate}
                      >
                        <DotsHorizontalIcon width="14" height="14" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tools */}
      <div className="nutrition-tools">
        <Button variant="outline" size="2" asChild>
          <Link to="/nutrition/meal-builder">Meal Builder</Link>
        </Button>
        <Button variant="outline" size="2" asChild>
          <Link to="/nutrition/calculate-targets">Calculate Targets</Link>
        </Button>
      </div>

      <TemplateSelectionModal
        isOpen={showTemplateModal}
        onClose={() => {
          setShowTemplateModal(false);
          setCurrentMealType(null);
        }}
        viewModel={templateSelectionViewModel}
        onApply={handleApplyTemplate}
      />

      <SaveAsTemplateDialog
        meal={saveAsTemplateMeal}
        onClose={() => setSaveAsTemplateMeal(null)}
        fetcher={fetcher}
      />

      <QuickEstimateModal
        isOpen={showQuickEstimate}
        onClose={() => setShowQuickEstimate(false)}
        currentDate={parsedCurrentDate}
      />
    </div>
  );
}

function SaveAsTemplateDialog({
  meal,
  onClose,
  fetcher,
}: {
  readonly meal: {
    readonly id: string;
    readonly category: MealCategory;
  } | null;
  readonly onClose: () => void;
  readonly fetcher: ReturnType<typeof useFetcher>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MealCategory>("lunch");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (meal) {
      setCategory(meal.category);
      setName("");
      setNotes("");
    }
  }, [meal]);

  const handleSave = () => {
    if (!meal || !name) return;

    fetcher.submit(
      {
        intent: "save-as-template",
        mealId: meal.id,
        name,
        category,
        notes,
      },
      { method: "post" },
    );

    onClose();
  };

  return (
    <AlertDialog.Root
      open={meal !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialog.Content>
        <AlertDialog.Title>Save as Template</AlertDialog.Title>
        <AlertDialog.Description>
          Save this meal as a reusable template.
        </AlertDialog.Description>

        <Flex direction="column" gap="3" mt="4">
          <Box>
            <Text as="label" size="2" weight="medium" mb="1">
              Template Name *
            </Text>
            <TextField.Root
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Post-workout meal"
            />
          </Box>

          <Box>
            <Text as="label" size="2" weight="medium" mb="1">
              Category
            </Text>
            <RadioGroup.Root
              value={category}
              onValueChange={(value: MealCategory) => setCategory(value)}
            >
              <Flex gap="4">
                <Flex align="center" gap="2">
                  <RadioGroup.Item value="breakfast" />
                  <Text size="2">Breakfast</Text>
                </Flex>
                <Flex align="center" gap="2">
                  <RadioGroup.Item value="lunch" />
                  <Text size="2">Lunch</Text>
                </Flex>
                <Flex align="center" gap="2">
                  <RadioGroup.Item value="dinner" />
                  <Text size="2">Dinner</Text>
                </Flex>
                <Flex align="center" gap="2">
                  <RadioGroup.Item value="snack" />
                  <Text size="2">Snack</Text>
                </Flex>
              </Flex>
            </RadioGroup.Root>
          </Box>

          <Box>
            <Text as="label" size="2" weight="medium" mb="1">
              Notes (optional)
            </Text>
            <TextField.Root
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this meal..."
            />
          </Box>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" onClick={onClose}>
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button onClick={handleSave} disabled={!name}>
              Save Template
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
