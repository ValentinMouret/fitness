import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DotsHorizontalIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Card,
  Container,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  IconButton,
  Progress,
  Text,
} from "@radix-ui/themes";
import { useState } from "react";
import {
  Link,
  useFetcher,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { TargetService } from "~/modules/core/application/measurement-service";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { NutritionService } from "~/modules/nutrition/application/service";
import type { MealLogWithNutrition } from "~/modules/nutrition/domain/meal-log";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";
import {
  createMealCardViewModel,
  createTemplateSelectionViewModel,
  EmptyMealCard,
  MealCard,
  TemplateSelectionModal,
} from "~/modules/nutrition/presentation";
import { addOneDay, removeOneDay, toDateString, today } from "~/time";
import { handleResultError } from "~/utils/errors";
import type { Route } from "./+types/meals";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");

  const currentDate = dateParam ? new Date(dateParam) : today();

  // Note: Ingredients loading removed since we're using direct navigation to meal builder

  // Fetch daily summary
  const dailySummaryResult =
    await NutritionService.getDailySummary(currentDate);

  // Fetch meal templates
  const mealTemplatesResult = await NutritionService.getAllMealTemplates();

  // Fetch targets
  const activeTargets = await TargetService.currentTargets();

  if (dailySummaryResult.isErr()) {
    handleResultError(dailySummaryResult, "Failed to load daily summary");
  }

  if (mealTemplatesResult.isErr()) {
    handleResultError(mealTemplatesResult, "Failed to load meal templates");
  }

  // Extract daily calorie target (for now, we'll just use this one target)
  let targets = null;
  if (activeTargets.isOk()) {
    const dailyCalorieTarget = activeTargets.value.find(
      (t) => t.measurement === baseMeasurements.dailyCalorieIntake.name,
    );
    if (dailyCalorieTarget) {
      targets = {
        calories: dailyCalorieTarget.value,
        protein: Math.round((dailyCalorieTarget.value * 0.3) / 4), // 30% protein
        carbs: Math.round((dailyCalorieTarget.value * 0.4) / 4), // 40% carbs
        fat: Math.round((dailyCalorieTarget.value * 0.3) / 9), // 30% fat
      };
    }
  }

  return {
    dailySummary: dailySummaryResult.value,
    mealTemplates: mealTemplatesResult.value,
    targets,
    currentDate: currentDate.toISOString(),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "apply-template") {
    const templateId = formData.get("templateId") as string;
    const mealCategory = formData.get("mealCategory") as MealCategory;
    const loggedDate = new Date(formData.get("loggedDate") as string);

    const result = await NutritionService.createMealLogFromTemplate(
      templateId,
      mealCategory,
      loggedDate,
    );

    if (result.isErr()) {
      return { success: false, error: "Failed to apply template" };
    }

    return { success: true };
  }

  if (intent === "delete-meal") {
    const mealId = formData.get("mealId") as string;

    const result = await NutritionService.deleteMealLog(mealId);

    if (result.isErr()) {
      return { success: false, error: "Failed to delete meal" };
    }

    return { success: true };
  }

  return { success: false, error: "Unknown intent" };
}

interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Default targets if none are configured
const defaultTargets: DailyTargets = {
  calories: 2100,
  protein: 140,
  carbs: 220,
  fat: 85,
};

function getMealIcon(mealType: MealCategory): string {
  const icons = {
    breakfast: "🌅",
    lunch: "🌞",
    dinner: "🌆",
    snack: "🍎",
  };
  return icons[mealType];
}

function getMealDisplayName(mealType: MealCategory): string {
  const names = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snacks",
  };
  return names[mealType];
}

export default function MealLogger({ loaderData }: Route.ComponentProps) {
  const { mealTemplates, dailySummary, targets, currentDate } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [currentMealType, setCurrentMealType] = useState<MealCategory | null>(
    null,
  );
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
  const goToToday = () => navigateToDate(today());

  const getMealForType = (mealType: MealCategory) => {
    return dailySummary.meals[mealType];
  };

  const formatDate = (date: Date) => {
    const isToday = date.toDateString() === today().toDateString();
    if (isToday) return "Today";

    const yesterday = removeOneDay(today());
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) return "Yesterday";

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ] as const;

    const weekday = weekdays[date.getDay()];
    const day = date.getDate().toString().padStart(2, " ");
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);

    return `${weekday} ${day} ${month} ${year}`;
  };

  const getMealBuilderUrl = (
    mealType: MealCategory,
    meal?: MealLogWithNutrition | null,
  ) => {
    const returnTo = `/nutrition/meals?date=${toDateString(parsedCurrentDate)}`;
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

  return (
    <Container size="4">
      {/* Header with date navigation */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <Link to="/nutrition">
          <IconButton variant="ghost" size="2">
            <ChevronLeftIcon width="16" height="16" />
          </IconButton>
        </Link>

        <Flex align="center" justify="center" gap="2">
          <IconButton
            variant="ghost"
            onClick={previousDay}
            aria-label="Previous day"
          >
            <ChevronLeftIcon width="16" height="16" />
          </IconButton>

          <Heading size="5">{formatDate(parsedCurrentDate)}</Heading>

          <IconButton variant="ghost" onClick={nextDay} aria-label="Next day">
            <ChevronRightIcon width="16" height="16" />
          </IconButton>
        </Flex>

        <Button variant="outline" size="2" onClick={goToToday}>
          Today
        </Button>
      </div>

      <Card size="3" mb="6">
        <Heading size="4" mb="4">
          Daily Progress
        </Heading>

        <Grid columns="2" gap="4" mb="4">
          <Box>
            <Flex justify="between" mb="2">
              <Text size="2">Calories</Text>
              <Text size="2" weight="medium">
                {dailyTotals.calories} / {dailyTargets.calories} kcal (
                {Math.round(
                  (dailyTotals.calories / dailyTargets.calories) * 100,
                )}
                %)
              </Text>
            </Flex>
            <Progress
              value={(dailyTotals.calories / dailyTargets.calories) * 100}
            />
          </Box>

          <Box>
            <Flex justify="between" mb="2">
              <Text size="2">Protein</Text>
              <Text size="2" weight="medium">
                {Math.round(dailyTotals.protein)}g / {dailyTargets.protein}g (
                {Math.round((dailyTotals.protein / dailyTargets.protein) * 100)}
                %)
              </Text>
            </Flex>
            <Progress
              value={(dailyTotals.protein / dailyTargets.protein) * 100}
            />
          </Box>

          <Box>
            <Flex justify="between" mb="2">
              <Text size="2">Carbs</Text>
              <Text size="2" weight="medium">
                {Math.round(dailyTotals.carbs)}g / {dailyTargets.carbs}g (
                {Math.round((dailyTotals.carbs / dailyTargets.carbs) * 100)}%)
              </Text>
            </Flex>
            <Progress value={(dailyTotals.carbs / dailyTargets.carbs) * 100} />
          </Box>

          <Box>
            <Flex justify="between" mb="2">
              <Text size="2">Fat</Text>
              <Text size="2" weight="medium">
                {Math.round(dailyTotals.fat)}g / {dailyTargets.fat}g (
                {Math.round((dailyTotals.fat / dailyTargets.fat) * 100)}%)
              </Text>
            </Flex>
            <Progress value={(dailyTotals.fat / dailyTargets.fat) * 100} />
          </Box>
        </Grid>
      </Card>

      {/* Meal Cards */}
      <Flex direction="column" gap="4" mb="6">
        {(["breakfast", "lunch", "dinner", "snack"] as MealCategory[]).map(
          (mealType) => {
            const meal = getMealForType(mealType);

            return (
              <Card key={mealType} size="3">
                <Flex justify="between" align="center" mb="3">
                  <Flex align="center" gap="2">
                    <Text size="4">{getMealIcon(mealType)}</Text>
                    <Heading size="4">{getMealDisplayName(mealType)}</Heading>
                  </Flex>
                  <Flex gap="2">
                    <Button size="2" variant="outline" asChild>
                      <Link to={getMealBuilderUrl(mealType, meal)}>
                        <PlusIcon width="16" height="16" />
                        {meal ? "Edit" : "Add"}
                      </Link>
                    </Button>
                    {meal ? (
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                          <IconButton variant="ghost" size="2">
                            <DotsHorizontalIcon width="16" height="16" />
                          </IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item
                            onClick={() => handleClearMeal(mealType)}
                          >
                            Clear Meal
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    ) : (
                      <IconButton
                        variant="ghost"
                        size="2"
                        style={{ visibility: "hidden" }}
                      >
                        <DotsHorizontalIcon width="16" height="16" />
                      </IconButton>
                    )}
                  </Flex>
                </Flex>

                {meal ? (
                  <MealCard viewModel={createMealCardViewModel(meal)} />
                ) : (
                  <EmptyMealCard
                    mealType={mealType}
                    onUseTemplate={handleUseTemplate}
                  />
                )}
              </Card>
            );
          },
        )}
      </Flex>

      <TemplateSelectionModal
        isOpen={showTemplateModal}
        onClose={() => {
          setShowTemplateModal(false);
          setCurrentMealType(null);
        }}
        viewModel={templateSelectionViewModel}
        onApply={handleApplyTemplate}
      />
    </Container>
  );
}
