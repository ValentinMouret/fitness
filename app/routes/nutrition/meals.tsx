import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DotsHorizontalIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { z } from "zod";
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
  Link,
  useFetcher,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { zfd } from "zod-form-data";
import type { MealLogWithNutrition } from "~/modules/nutrition/domain/meal-log";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";
import {
  createMealCardViewModel,
  createTemplateSelectionViewModel,
  EmptyMealCard,
  MealCard,
  TemplateSelectionModal,
} from "~/modules/nutrition/presentation";
import { PageHeader } from "~/components/PageHeader";
import { SectionHeader } from "~/components/SectionHeader";
import { addOneDay, removeOneDay, toDateString, today } from "~/time";
import type { Route } from "./+types/meals";
import {
  applyMealTemplate,
  deleteMealLog,
  getMealsPageData,
  saveMealAsTemplate,
} from "~/modules/nutrition/application/meals-page.service.server";
import { formOptionalText, formText } from "~/utils/form-data";

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
  const [saveAsTemplateMeal, setSaveAsTemplateMeal] = useState<{
    id: string;
    category: MealCategory;
  } | null>(null);
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

  const title = (
    <Flex align="center" justify="center" gap="2">
      <IconButton
        variant="ghost"
        onClick={previousDay}
        aria-label="Previous day"
      >
        <ChevronLeftIcon width="16" height="16" />
      </IconButton>

      <Heading size="7">{formatDate(parsedCurrentDate)}</Heading>

      <IconButton variant="ghost" onClick={nextDay} aria-label="Next day">
        <ChevronRightIcon width="16" height="16" />
      </IconButton>
    </Flex>
  );

  return (
    <>
      <PageHeader
        title={title}
        backTo="/nutrition"
        primaryAction={{
          label: "Today",
          onClick: goToToday,
          type: "button",
        }}
      />

      <Card size="3" mb="6">
        <SectionHeader title="Daily Progress" />

        <Grid columns="2" gap="4" mb="4">
          <Box>
            <Flex justify="between" mb="2">
              <Text size="2">Calories</Text>
              <Text size="2" weight="medium">
                {Math.round(dailyTotals.calories)} / {dailyTargets.calories}{" "}
                kcal (
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
        {(["breakfast", "lunch", "dinner", "snack"] as const).map(
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

      <SaveAsTemplateDialog
        meal={saveAsTemplateMeal}
        onClose={() => setSaveAsTemplateMeal(null)}
        fetcher={fetcher}
      />
    </>
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

  // Sync category when a new meal is selected
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
