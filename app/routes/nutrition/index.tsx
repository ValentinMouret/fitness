import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DotsHorizontalIcon,
  Link2Icon,
  Pencil1Icon,
  Share1Icon,
} from "@radix-ui/react-icons";
import {
  AlertDialog,
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  type ActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  useFetcher,
  useFetchers,
  useSearchParams,
} from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { Celebration, SuccessPulse } from "~/components/Celebration";
import { PageHeader } from "~/components/PageHeader";
import RequiredStar from "~/components/RequiredStar";
import { SectionHeader } from "~/components/SectionHeader";
import { getAccountToday } from "~/modules/auth/infra/account-settings.server";
import { authenticatedUserContext } from "~/modules/auth/infra/user-context.server";
import type { MealLogWithNutrition } from "~/modules/nutrition/domain/meal-log";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";
import {
  applyMealTemplate,
  deleteMealLog,
  getMealsPageData,
  saveMealAsTemplate,
  setMealTemplatePublic,
} from "~/modules/nutrition/infra/meals-page.service.server";
import {
  createTemplateSelectionViewModel,
  QuickEstimateModal,
  TemplateSelectionModal,
} from "~/modules/nutrition/presentation";
import {
  MealAssignments,
  mealLabels,
} from "~/modules/nutrition/presentation/components/MealAssignments/MealAssignments";
import { NutritionNavigation } from "~/modules/nutrition/presentation/components/NutritionNavigation/NutritionNavigation";
import { NutritionSummary } from "~/modules/nutrition/presentation/components/NutritionSummary/NutritionSummary";
import { mealAssignmentsField } from "~/modules/nutrition/presentation/meal-builder-form";
import {
  addCalendarDay,
  isSameCalendarDay,
  removeCalendarDay,
  toDateString,
} from "~/time";
import { isEditableTarget } from "~/utils/dom";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types";
import "./index.css";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const todayDate = await getAccountToday(
    context.get(authenticatedUserContext).id,
  );
  const currentDate = dateParam ? new Date(dateParam) : todayDate;
  return {
    ...(await getMealsPageData(
      context.get(authenticatedUserContext).id,
      currentDate,
    )),
    todayDate,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
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

    const result = await applyMealTemplate(
      context.get(authenticatedUserContext).id,
      {
        templateId: parsed.templateId,
        mealCategory: parsed.mealCategory,
        loggedDate,
      },
    );

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

    const result = await deleteMealLog(
      context.get(authenticatedUserContext).id,
      { mealId: parsed.mealId },
    );

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  if (intent === "toggle-template-public") {
    const schema = zfd.formData({
      templateId: formText(z.string().min(1)),
      isPublic: formText(z.enum(["true", "false"])),
    });
    const parsed = schema.parse(formData);

    const result = await setMealTemplatePublic(
      context.get(authenticatedUserContext).id,
      {
        templateId: parsed.templateId,
        isPublic: parsed.isPublic === "true",
      },
    );

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  if (intent === "save-as-template") {
    const schema = zfd.formData({
      mealId: formText(z.string().min(1)),
      name: formText(z.string().min(1)),
      categories: mealAssignmentsField,
      notes: formOptionalText(),
    });
    const parsed = schema.parse(formData);

    const result = await saveMealAsTemplate(
      context.get(authenticatedUserContext).id,
      {
        mealId: parsed.mealId,
        name: parsed.name,
        categories: parsed.categories,
        notes: parsed.notes ?? undefined,
      },
    );

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  return { success: false, error: "Unknown intent" };
}

const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

function formatDateLabel(date: Date, todayDate: Date): string {
  const isToday = isSameCalendarDay(date, todayDate);
  if (isToday) return "Today";

  const yesterday = removeCalendarDay(todayDate);
  const isYesterday = isSameCalendarDay(date, yesterday);
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function NutritionPage({ loaderData }: Route.ComponentProps) {
  const { mealTemplates, dailySummary, targets, targetSource, currentDate } =
    loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const templateOpenerRef = useRef<HTMLButtonElement>(null);
  const [currentMealType, setCurrentMealType] = useState<MealCategory | null>(
    null,
  );
  const [saveAsTemplateMeal, setSaveAsTemplateMeal] = useState<{
    id: string;
    category: MealCategory;
  } | null>(null);
  const [showQuickEstimate, setShowQuickEstimate] = useState(false);
  const fetcher = useFetcher();
  const fetchers = useFetchers();

  const activeFetchers = fetchers.filter((f) => f.state !== "idle");
  const optimisticMealActions = activeFetchers.filter((f) => {
    const intent = f.formData?.get("intent");
    return intent === "apply-template" || intent === "delete-meal";
  });

  const mealCompletionMap = Object.fromEntries(
    mealTypes.map((t) => [t, !!dailySummary.meals[t]]),
  );
  for (const f of optimisticMealActions) {
    const category = z
      .enum(mealTypes)
      .safeParse(f.formData?.get("mealCategory"));
    if (category.success)
      mealCompletionMap[category.data] =
        f.formData?.get("intent") === "apply-template";
    else if (f.formData?.get("intent") === "delete-meal") {
      const id = f.formData?.get("mealId");
      const type = mealTypes.find((t) => dailySummary.meals[t]?.id === id);
      if (type) mealCompletionMap[type] = false;
    }
  }

  const completedCount =
    Object.values(mealCompletionMap).filter(Boolean).length;
  const [celebrate, setCelebrate] = useState(false);
  const prevCount = useRef(completedCount);

  useEffect(() => {
    if (
      completedCount === mealTypes.length &&
      prevCount.current < mealTypes.length
    ) {
      setCelebrate(true);
    }
    prevCount.current = completedCount;
  }, [completedCount]);

  const templateSelectionViewModel = currentMealType
    ? createTemplateSelectionViewModel(currentMealType, mealTemplates)
    : null;

  const parsedCurrentDate = new Date(currentDate);
  const todayDate = new Date(loaderData.todayDate);
  const dailyTotals = dailySummary.dailyTotals;
  const dailyTargets = targets;

  const navigateToDate = useCallback(
    (newDate: Date) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("date", toDateString(newDate));
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams],
  );

  const previousDay = useCallback(
    () => navigateToDate(removeCalendarDay(parsedCurrentDate)),
    [navigateToDate, parsedCurrentDate],
  );
  const nextDay = useCallback(
    () => navigateToDate(addCalendarDay(parsedCurrentDate)),
    [navigateToDate, parsedCurrentDate],
  );
  const goToToday = useCallback(
    () => navigateToDate(todayDate),
    [navigateToDate, todayDate],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (isEditableTarget(e.target)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        previousDay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextDay();
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        goToToday();
      } else if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        setShowQuickEstimate(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previousDay, nextDay, goToToday]);

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

  const copyShareLink = (templateId: string) => {
    const url = `${window.location.origin}/share/meal/${templateId}`;
    void navigator.clipboard?.writeText(url);
  };

  const handleCopyLink = (templateId: string) => {
    copyShareLink(templateId);
  };

  const handleToggleShare = (templateId: string, makePublic: boolean) => {
    if (makePublic) {
      // Copy immediately while inside the user gesture, then publish.
      copyShareLink(templateId);
    }
    fetcher.submit(
      {
        intent: "toggle-template-public",
        templateId,
        isPublic: String(makePublic),
      },
      { method: "post" },
    );
  };

  return (
    <div className="nutrition-page">
      <PageHeader title="Nutrition" />
      <div className="nutrition-date-nav">
        <Tooltip content="Previous day (Left Arrow)">
          <IconButton
            variant="ghost"
            onClick={previousDay}
            aria-label="Previous day (Left Arrow)"
            aria-keyshortcuts="ArrowLeft"
          >
            <ChevronLeftIcon width="16" height="16" />
          </IconButton>
        </Tooltip>
        <Button
          type="button"
          variant="ghost"
          onClick={goToToday}
          aria-label="Go to Today (T)"
          aria-keyshortcuts="t"
        >
          {formatDateLabel(parsedCurrentDate, todayDate)}
        </Button>
        <Tooltip content="Next day (Right Arrow)">
          <IconButton
            type="button"
            variant="ghost"
            onClick={nextDay}
            aria-label="Next day (Right Arrow)"
            aria-keyshortcuts="ArrowRight"
          >
            <ChevronRightIcon width="16" height="16" />
          </IconButton>
        </Tooltip>
      </div>

      <SectionHeader
        title="Your day"
        right={
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger>
              <IconButton
                type="button"
                variant="ghost"
                aria-label="More Nutrition actions"
              >
                <DotsHorizontalIcon />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onClick={() => setShowQuickEstimate(true)}>
                Estimate meal
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link to="/nutrition/meal-builder">Meal builder</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link to="/nutrition/calculate-targets">Calculate targets</Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        }
      />
      <p className="nutrition-description">
        Meals and progress, one day at a time.
      </p>
      <output className="nutrition-feedback">
        {completedCount === mealTypes.length && (
          <Text size="1" color="green">
            All Done! ✨
          </Text>
        )}
        {targetSource === "default" && (
          <Text as="span" size="2" color="gray">
            Default targets.{" "}
            <Link to="/nutrition/calculate-targets">Set your own</Link>.
          </Text>
        )}
      </output>

      <NutritionSummary totals={dailyTotals} targets={dailyTargets} />

      <div className="nutrition-meals">
        <Celebration
          trigger={celebrate}
          onComplete={() => setCelebrate(false)}
        />
        <div className="nutrition-meals__list">
          {mealTypes.map((mealType) => {
            const meal = getMealForType(mealType);
            const hasLogged = meal !== null;
            const label = mealLabels[mealType];
            const ingredientNames = meal?.ingredients
              ?.map((ing) => ing.ingredient.name)
              .join(" · ");

            const isDeleting = fetchers.some(
              (f) =>
                f.state !== "idle" &&
                f.formData?.get("intent") === "delete-meal" &&
                f.formData?.get("mealId") === meal?.id,
            );

            const isApplyingTemplate = fetchers.some(
              (f) =>
                f.state !== "idle" &&
                f.formData?.get("intent") === "apply-template" &&
                f.formData?.get("mealCategory") === mealType,
            );

            return (
              <SuccessPulse
                key={mealType}
                trigger={isDeleting || isApplyingTemplate}
              >
                <div
                  className={`nutrition-meal ${mealCompletionMap[mealType] ? "nutrition-meal--logged" : ""}`}
                >
                  <div className="nutrition-meal__body">
                    <h3 className="nutrition-meal__name">{label}</h3>
                    {hasLogged && (
                      <div className="nutrition-meal__detail">
                        {Math.round(meal.totals.calories)} kcal
                      </div>
                    )}
                    {hasLogged && ingredientNames ? (
                      <div className="nutrition-meal__detail">
                        {ingredientNames}
                      </div>
                    ) : !hasLogged ? (
                      <div className="nutrition-meal__detail nutrition-meal__detail--empty">
                        Nothing logged yet
                      </div>
                    ) : null}
                  </div>
                  <div className="nutrition-meal__actions">
                    {hasLogged ? (
                      <>
                        <Tooltip content={`Edit ${label}`}>
                          <Button
                            size="1"
                            variant="soft"
                            asChild
                            aria-label={`Edit ${label}`}
                          >
                            <Link to={getMealBuilderUrl(mealType, meal)}>
                              <Pencil1Icon width="14" height="14" />
                              Edit
                            </Link>
                          </Button>
                        </Tooltip>
                        <DropdownMenu.Root modal={false}>
                          <Tooltip content={`Meal actions for ${label}`}>
                            <DropdownMenu.Trigger>
                              <Button
                                variant="ghost"
                                size="1"
                                aria-label={`Meal actions for ${label}`}
                                loading={isDeleting}
                              >
                                <DotsHorizontalIcon width="14" height="14" />
                              </Button>
                            </DropdownMenu.Trigger>
                          </Tooltip>
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
                            {meal.mealTemplateId &&
                              (() => {
                                const template = mealTemplates.find(
                                  (t) => t.id === meal.mealTemplateId,
                                );
                                if (!template) return null;
                                return template.isPublic ? (
                                  <>
                                    <DropdownMenu.Item
                                      onClick={() =>
                                        handleCopyLink(template.id)
                                      }
                                    >
                                      <Link2Icon /> Copy link
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      color="red"
                                      onClick={() =>
                                        handleToggleShare(template.id, false)
                                      }
                                    >
                                      Stop sharing
                                    </DropdownMenu.Item>
                                  </>
                                ) : (
                                  <DropdownMenu.Item
                                    onClick={() =>
                                      handleToggleShare(template.id, true)
                                    }
                                  >
                                    <Share1Icon /> Publish &amp; copy link
                                  </DropdownMenu.Item>
                                );
                              })()}
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
                        <Tooltip content={`Log ${label}`}>
                          <Button
                            size="1"
                            variant="solid"
                            asChild
                            aria-label={`Log ${label}`}
                          >
                            <Link to={getMealBuilderUrl(mealType)}>Log</Link>
                          </Button>
                        </Tooltip>
                        <DropdownMenu.Root modal={false}>
                          <DropdownMenu.Trigger>
                            <IconButton
                              type="button"
                              variant="ghost"
                              aria-label={`Meal actions for ${label}`}
                              loading={isApplyingTemplate}
                              onPointerDown={(event) => {
                                templateOpenerRef.current = event.currentTarget;
                              }}
                              onFocus={(event) => {
                                templateOpenerRef.current = event.currentTarget;
                              }}
                            >
                              <DotsHorizontalIcon />
                            </IconButton>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content
                            onCloseAutoFocus={(event) => {
                              if (showTemplateModal) event.preventDefault();
                            }}
                          >
                            <DropdownMenu.Item
                              onSelect={() => handleUseTemplate(mealType)}
                            >
                              Use template
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                      </>
                    )}
                  </div>
                </div>
              </SuccessPulse>
            );
          })}
        </div>
      </div>

      <div className="nutrition-tools">
        <Button variant="ghost" size="2" asChild>
          <Link to="/nutrition/meal-builder">Meal Builder</Link>
        </Button>
        <Button variant="ghost" size="2" asChild>
          <Link to="/nutrition/calculate-targets">Calculate targets</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="2"
          onClick={() => setShowQuickEstimate(true)}
          aria-label="Estimate meal (E)"
          aria-keyshortcuts="e"
        >
          Estimate meal
        </Button>
      </div>
      <NutritionNavigation
        current="today"
        date={searchParams.get("date") ?? undefined}
      />

      <TemplateSelectionModal
        isOpen={showTemplateModal}
        returnFocusRef={templateOpenerRef}
        onClose={() => {
          setShowTemplateModal(false);
          setCurrentMealType(null);
        }}
        viewModel={templateSelectionViewModel}
        onApply={handleApplyTemplate}
        onCopyLink={handleCopyLink}
        onToggleShare={handleToggleShare}
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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<readonly MealCategory[]>([]);
  const [notes, setNotes] = useState("");

  const nameId = useId();
  const notesId = useId();

  useEffect(() => {
    if (meal) {
      setCategories([meal.category]);
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
        categories: JSON.stringify(categories),
        notes,
      },
      { method: "post" },
    );

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && name) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <AlertDialog.Root
      open={meal !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialog.Content
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nameInputRef.current?.focus();
        }}
        onKeyDown={handleKeyDown}
      >
        <AlertDialog.Title>Save as Template</AlertDialog.Title>
        <AlertDialog.Description>
          Save this meal as a reusable template.
        </AlertDialog.Description>

        <Flex direction="column" gap="3" mt="4">
          <Box>
            <Text
              as="label"
              htmlFor={nameId}
              size="2"
              weight="medium"
              mb="1"
              style={{ display: "block" }}
            >
              Template Name <RequiredStar />
            </Text>
            <TextField.Root
              id={nameId}
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Post-workout meal"
            />
          </Box>

          <MealAssignments selected={categories} onChange={setCategories} />

          <Box>
            <Text
              as="label"
              htmlFor={notesId}
              size="2"
              weight="medium"
              mb="1"
              style={{ display: "block" }}
            >
              Notes (optional)
            </Text>
            <TextField.Root
              id={notesId}
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
            <Tooltip content="Save (Cmd/Ctrl+Enter)">
              <Box display="inline-block">
                <Button
                  onClick={handleSave}
                  disabled={!name || categories.length === 0}
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                >
                  Save Template
                </Button>
              </Box>
            </Tooltip>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
