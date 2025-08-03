import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Flex,
  Grid,
  Heading,
  IconButton,
  RadioGroup,
  Tabs,
  Text,
  TextField,
  AlertDialog,
} from "@radix-ui/themes";
import {
  ChevronLeftIcon,
  Cross2Icon,
  PlusIcon,
  MagicWandIcon,
  DownloadIcon,
} from "@radix-ui/react-icons";
import {
  Link,
  useFetcher,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type Route,
} from "react-router";
import { NutritionService } from "~/modules/nutrition/application/service";
import type { Ingredient } from "~/modules/nutrition/domain/ingredient";
import {
  ingredientCategories,
  Ingredient as IngredientDomain,
} from "~/modules/nutrition/domain/ingredient";
import type { CreateMealTemplateInput } from "~/modules/nutrition/domain/meal-template";
import {
  calculateSatietyScore,
  mealCategories,
  type MealCategory,
} from "~/modules/nutrition/domain/meal-template";
import {
  ObjectivesPanel,
  CurrentTotalsPanel,
  IngredientCard,
  AIIngredientReviewModal,
  type Objectives,
  type SelectedIngredient,
} from "~/modules/nutrition/presentation";
import type { CreateAIIngredientInput } from "~/modules/nutrition/domain/ingredient";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search") || undefined;
  const category = url.searchParams.get("category") || undefined;

  // Meal logging mode parameters
  const mealCategoryParam = url.searchParams.get("meal");
  const mealCategory =
    mealCategoryParam &&
    mealCategories.includes(mealCategoryParam as MealCategory)
      ? (mealCategoryParam as MealCategory)
      : null;
  const dateParam = url.searchParams.get("date");
  const mealId = url.searchParams.get("mealId");
  const returnTo = url.searchParams.get("returnTo");

  const [ingredientsResult, templatesResult] = await Promise.all([
    NutritionService.searchIngredients(searchTerm, category),
    NutritionService.getAllMealTemplates(),
  ]);

  if (ingredientsResult.isErr()) {
    throw new Error("Failed to load ingredients");
  }

  if (templatesResult.isErr()) {
    throw new Error("Failed to load meal templates");
  }

  // If in meal logging mode and editing an existing meal, fetch the meal data
  let existingMeal = null;
  if (mealId) {
    const mealResult = await NutritionService.getMealLogWithIngredients(mealId);
    if (mealResult.isOk()) {
      existingMeal = mealResult.value;
    }
  }

  return {
    ingredients: ingredientsResult.value,
    mealTemplates: templatesResult.value,
    // Meal logging context
    mealLoggingMode: {
      isEnabled: Boolean(mealCategory && dateParam && returnTo),
      mealCategory,
      date: dateParam,
      returnTo,
      existingMeal,
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (intent === "save-template") {
    const name = formData.get("name")?.toString();
    const categoryValue = formData.get("category")?.toString();
    const notes = formData.get("notes")?.toString();
    const ingredientsJson = formData.get("ingredients")?.toString();

    if (!name || !categoryValue || !ingredientsJson) {
      throw new Error("Missing required fields");
    }

    if (!mealCategories.includes(categoryValue as MealCategory)) {
      throw new Error("Invalid meal category");
    }

    const category = categoryValue as MealCategory;

    try {
      const ingredientsData = JSON.parse(ingredientsJson);

      // Convert ingredient data back to domain objects
      const ingredients = await Promise.all(
        ingredientsData.map(async (item: { id: string; quantity: number }) => {
          const ingredientResult = await NutritionService.getIngredientById(
            item.id,
          );
          if (ingredientResult.isErr()) {
            throw new Error(`Failed to find ingredient: ${item.id}`);
          }
          return {
            ingredient: ingredientResult.value,
            quantityGrams: item.quantity,
          };
        }),
      );

      const input: CreateMealTemplateInput = {
        name,
        category,
        notes,
        ingredients,
      };

      const result = await NutritionService.createMealTemplate(input);

      if (result.isErr()) {
        throw new Error("Failed to save meal template");
      }

      return { success: true, template: result.value };
    } catch (error) {
      throw new Error("Invalid ingredient data");
    }
  }

  if (intent === "save-meal") {
    const mealCategoryParam = formData.get("mealCategory")?.toString();
    const mealCategory =
      mealCategoryParam &&
      mealCategories.includes(mealCategoryParam as MealCategory)
        ? (mealCategoryParam as MealCategory)
        : null;
    const loggedDate = formData.get("loggedDate")?.toString();
    const ingredientsJson = formData.get("ingredients")?.toString();
    const returnTo = formData.get("returnTo")?.toString();
    const mealId = formData.get("mealId")?.toString(); // For editing existing meals
    const notes = formData.get("notes")?.toString();

    if (!mealCategory || !loggedDate || !ingredientsJson) {
      throw new Error("Missing required fields for meal logging");
    }

    try {
      const ingredientsData = JSON.parse(ingredientsJson);
      const parsedDate = new Date(loggedDate);

      // Convert ingredient data back to domain objects
      const ingredients = await Promise.all(
        ingredientsData.map(async (item: { id: string; quantity: number }) => {
          const ingredientResult = await NutritionService.getIngredientById(
            item.id,
          );
          if (ingredientResult.isErr()) {
            throw new Error(`Failed to find ingredient: ${item.id}`);
          }
          return {
            ingredient: ingredientResult.value,
            quantityGrams: item.quantity,
          };
        }),
      );

      let result: Awaited<
        ReturnType<
          | typeof NutritionService.createMealLog
          | typeof NutritionService.updateMealLog
        >
      >;
      if (mealId) {
        // Update existing meal
        result = await NutritionService.updateMealLog(mealId, {
          ingredients,
          notes,
        });
      } else {
        // Create new meal
        result = await NutritionService.createMealLog({
          mealCategory,
          loggedDate: parsedDate,
          ingredients,
          notes,
        });
      }

      if (result.isErr()) {
        throw new Error("Failed to save meal");
      }

      // Redirect back to the meal logger
      return redirect(returnTo || "/nutrition/meals");
    } catch (error) {
      throw new Error("Invalid meal data");
    }
  }

  if (intent === "search-ai-ingredient") {
    const query = formData.get("query")?.toString();
    if (!query) {
      throw new Error("Search query is required");
    }

    try {
      const result = await NutritionService.searchIngredientWithAI(query);
      return { aiIngredient: result };
    } catch (error) {
      console.error("AI ingredient search error:", error);
      return {
        error: "Failed to search ingredient with AI. Please try again.",
      };
    }
  }

  if (intent === "save-ai-ingredient") {
    const ingredientDataJson = formData.get("ingredientData")?.toString();
    if (!ingredientDataJson) {
      throw new Error("Ingredient data is required");
    }

    try {
      const ingredientData: CreateAIIngredientInput =
        JSON.parse(ingredientDataJson);
      const result = await NutritionService.createIngredient(ingredientData);

      if (result.isErr()) {
        throw new Error("Failed to save AI ingredient");
      }

      return { success: true, ingredient: result.value };
    } catch (error) {
      console.error("Save AI ingredient error:", error);
      return { error: "Failed to save ingredient. Please try again." };
    }
  }

  throw new Error("Invalid intent");
}

const TEXTURE_LABELS = {
  liquid: "💧 Liquid",
  semi_liquid: "🥤 Semi-liquid",
  soft_solid: "🍮 Soft solid",
  firm_solid: "🥩 Firm solid",
};

function getIngredientIcon(name: string): string {
  const iconMap: Record<string, string> = {
    "Chicken Breast": "🍗",
    "Beef, Lean Ground": "🥩",
    "Eggs, Whole": "🥚",
    "Tofu, Firm": "🧊",
    "Salmon, Atlantic": "🐟",
    "Greek Yogurt": "🥛",
    "Milk, Whole": "🥛",
    "Cheddar Cheese": "🧀",
    "White Rice, Cooked": "🍚",
    "Brown Rice, Cooked": "🍚",
    "Pasta, Cooked": "🍝",
    "Oats, Rolled": "🥣",
    "Sweet Potato": "🍠",
    "Quinoa, Cooked": "🌾",
    "Broccoli, Steamed": "🥦",
    "Spinach, Raw": "🥬",
    "Bell Pepper": "🫑",
    Carrots: "🥕",
    Tomatoes: "🍅",
    "Olive Oil": "🫒",
    Avocado: "🥑",
    Almonds: "🌰",
    "Peanut Butter": "🥜",
  };
  return iconMap[name] || "🥘";
}

export default function MealBuilder({
  loaderData: { ingredients, mealTemplates, mealLoggingMode },
}: Route.ComponentProps) {
  const fetcher = useFetcher();

  const [objectives, setObjectives] = useState<Objectives>({
    calories: null,
    protein: null,
    carbs: null,
    fats: null,
    satiety: 3,
  });

  const [selectedIngredients, setSelectedIngredients] = useState<
    SelectedIngredient[]
  >([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // AI search state
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiIngredientData, setAiIngredientData] =
    useState<CreateAIIngredientInput | null>(null);
  const [isAIReviewModalOpen, setIsAIReviewModalOpen] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);

  // Pre-populate ingredients when editing an existing meal
  useEffect(() => {
    if (mealLoggingMode.existingMeal?.ingredients) {
      const convertedIngredients: SelectedIngredient[] =
        mealLoggingMode.existingMeal.ingredients.map((item) => ({
          ...item.ingredient,
          quantity: item.quantityGrams,
          defaultRange: [
            item.ingredient.sliderMin,
            item.ingredient.sliderMax,
          ] as const,
          unit: "g",
        }));
      setSelectedIngredients(convertedIngredients);
    }
  }, [mealLoggingMode.existingMeal]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Calculate totals using domain methods
  const totals = useMemo(() => {
    const ingredientsWithQuantity = selectedIngredients.map((ing) => ({
      ingredient: ing,
      quantityGrams: ing.quantity,
    }));
    return IngredientDomain.calculateTotalNutrition(ingredientsWithQuantity);
  }, [selectedIngredients]);

  // Calculate satiety using domain method
  const satietyCalculation = useMemo(() => {
    const ingredientsWithQuantity = selectedIngredients.map((ing) => ({
      ingredient: ing,
      quantityGrams: ing.quantity,
    }));
    return calculateSatietyScore(ingredientsWithQuantity, totals);
  }, [selectedIngredients, totals]);

  const satietyScore = satietyCalculation.level;

  const satietyDuration = `~${satietyCalculation.estimatedSatisfactionHours.min}-${satietyCalculation.estimatedSatisfactionHours.max} hours`;

  // Filter ingredients for modal
  const filteredIngredients = ingredients.filter((ing) => {
    const matchesSearch = ing.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || ing.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // AI Suggestions logic
  const aiSuggestions = useMemo(() => {
    const suggestions = [];

    if (objectives.protein && totals.protein < objectives.protein) {
      const deficit = objectives.protein - totals.protein;
      const greekYogurt = ingredients.find((i) => i.name === "Greek Yogurt");
      if (greekYogurt) {
        const quantity = Math.round((deficit / greekYogurt.protein) * 100);
        suggestions.push({
          type: "add",
          ingredient: greekYogurt,
          quantity,
          reason: `Add ${quantity}g Greek Yogurt for +${Math.round((greekYogurt.protein * quantity) / 100)}g protein`,
        });
      }
    }

    if (objectives.calories && totals.calories < objectives.calories * 0.8) {
      suggestions.push({
        type: "increase",
        reason: "Consider adding more calorie-dense foods like nuts or oils",
      });
    }

    if (satietyScore < objectives.satiety) {
      suggestions.push({
        type: "satiety",
        reason:
          "Add high-fiber vegetables or increase protein for better satiety",
      });
    }

    return suggestions;
  }, [objectives, totals, satietyScore, ingredients]);

  const handleAddIngredient = useCallback((ingredient: Ingredient) => {
    const midpoint = (ingredient.sliderMin + ingredient.sliderMax) / 2;
    setSelectedIngredients((prev) => [
      ...prev,
      {
        ...ingredient,
        quantity: midpoint,
        defaultRange: [ingredient.sliderMin, ingredient.sliderMax],
        unit: "g",
      },
    ]);
    setIsAddModalOpen(false);
  }, []);

  const handleUpdateQuantity = (id: string, quantity: number) => {
    setSelectedIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, quantity } : ing)),
    );
  };

  const handleRemoveIngredient = (id: string) => {
    setSelectedIngredients((prev) => prev.filter((ing) => ing.id !== id));
  };

  // AI search handlers
  const handleAISearch = () => {
    if (!searchQuery.trim()) return;

    setIsAISearching(true);
    setAiSearchError(null);

    fetcher.submit(
      {
        intent: "search-ai-ingredient",
        query: searchQuery.trim(),
      },
      { method: "post" },
    );
  };

  const handleSaveAIIngredient = (ingredientData: CreateAIIngredientInput) => {
    fetcher.submit(
      {
        intent: "save-ai-ingredient",
        ingredientData: JSON.stringify(ingredientData),
      },
      { method: "post" },
    );
  };

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.aiIngredient) {
        setIsAISearching(false);
        const result = fetcher.data.aiIngredient;
        if (result.found) {
          setAiIngredientData(result.data);
          setIsAIReviewModalOpen(true);
        } else {
          setAiSearchError(
            "Ingredient not found by AI. Please try a different search term.",
          );
        }
      } else if (fetcher.data.success && fetcher.data.ingredient) {
        // Successfully saved AI ingredient, add it to selected ingredients
        const newIngredient = fetcher.data.ingredient;
        handleAddIngredient(newIngredient);
        setIsAIReviewModalOpen(false);
        setAiIngredientData(null);
      } else if (fetcher.data.error) {
        setIsAISearching(false);
        setAiSearchError(fetcher.data.error);
      }
    }
  }, [fetcher.data, handleAddIngredient]);

  return (
    <Container size="4">
      <Flex align="center" gap="3" mb="6">
        <Link
          to={
            mealLoggingMode.isEnabled
              ? mealLoggingMode.returnTo || "/nutrition/meals"
              : "/nutrition"
          }
        >
          <IconButton variant="ghost" size="2">
            <ChevronLeftIcon width="16" height="16" />
          </IconButton>
        </Link>
        <Heading size="6">
          {mealLoggingMode.isEnabled
            ? `${mealLoggingMode.existingMeal ? "Edit" : "Add"} ${mealLoggingMode.mealCategory?.charAt(0).toUpperCase()}${mealLoggingMode.mealCategory?.slice(1)}${mealLoggingMode.date ? ` for ${new Date(mealLoggingMode.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}` : ""}`
            : "Meal Builder"}
        </Heading>
      </Flex>

      <Grid columns="2" gap="4" mb="6">
        <ObjectivesPanel
          objectives={objectives}
          setObjectives={setObjectives}
        />
        <CurrentTotalsPanel
          objectives={objectives}
          totals={totals}
          satietyScore={satietyScore}
          satietyDuration={satietyDuration}
        />
      </Grid>

      <Box mb="6">
        <Heading size="4" mb="3">
          Selected Ingredients ({selectedIngredients.length})
        </Heading>
        <Flex direction="column" gap="3">
          {selectedIngredients.map((ingredient) => (
            <IngredientCard
              key={ingredient.id}
              ingredient={ingredient}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemoveIngredient}
            />
          ))}
        </Flex>
      </Box>

      <Flex gap="3" mb="6">
        <Dialog.Root open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <Dialog.Trigger>
            <Button variant="outline">
              <PlusIcon width="16" height="16" />
              Add Ingredient
            </Button>
          </Dialog.Trigger>
          <AddIngredientModal
            ingredients={filteredIngredients}
            onAdd={handleAddIngredient}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onAISearch={handleAISearch}
            isAISearching={isAISearching}
            aiSearchError={aiSearchError}
          />
        </Dialog.Root>

        <Button
          variant="outline"
          onClick={() => setShowAISuggestions(!showAISuggestions)}
        >
          <MagicWandIcon width="16" height="16" />
          AI Suggest
        </Button>

        {mealLoggingMode.isEnabled ? (
          <Button
            onClick={() => {
              // Submit save-meal form
              const ingredientsData = selectedIngredients.map((ing) => ({
                id: ing.id,
                quantity: ing.quantity,
              }));

              fetcher.submit(
                {
                  intent: "save-meal",
                  mealCategory: mealLoggingMode.mealCategory ?? "",
                  loggedDate: mealLoggingMode.date ?? "",
                  returnTo: mealLoggingMode.returnTo ?? "",
                  mealId: mealLoggingMode.existingMeal?.id || "",
                  ingredients: JSON.stringify(ingredientsData),
                  notes: "", // TODO: Add notes field if needed
                },
                { method: "post" },
              );
            }}
            disabled={selectedIngredients.length === 0}
          >
            <DownloadIcon width="16" height="16" />
            {mealLoggingMode.existingMeal ? "Update Meal" : "Save Meal"}
          </Button>
        ) : (
          <AlertDialog.Root
            open={showSaveDialog}
            onOpenChange={setShowSaveDialog}
          >
            <AlertDialog.Trigger>
              <Button variant="outline">
                <DownloadIcon width="16" height="16" />
                Save Template
              </Button>
            </AlertDialog.Trigger>
            <SaveTemplateDialog
              onClose={() => setShowSaveDialog(false)}
              selectedIngredients={selectedIngredients}
              fetcher={fetcher}
            />
          </AlertDialog.Root>
        )}
      </Flex>

      {showAISuggestions && (
        <AISuggestionsPanel
          suggestions={aiSuggestions}
          onClose={() => setShowAISuggestions(false)}
        />
      )}

      {aiIngredientData && (
        <AIIngredientReviewModal
          isOpen={isAIReviewModalOpen}
          onClose={() => {
            setIsAIReviewModalOpen(false);
            setAiIngredientData(null);
            setAiSearchError(null);
          }}
          aiIngredientData={aiIngredientData}
          onSave={handleSaveAIIngredient}
          isLoading={fetcher.state === "submitting"}
        />
      )}
    </Container>
  );
}

function AddIngredientModal({
  ingredients,
  onAdd,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onAISearch,
  isAISearching,
  aiSearchError,
}: {
  ingredients: readonly Ingredient[];
  onAdd: (ingredient: Ingredient) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  onAISearch: () => void;
  isAISearching: boolean;
  aiSearchError: string | null;
}) {
  const categories = ["all", ...ingredientCategories];

  return (
    <Dialog.Content size="3">
      <Flex justify="between" align="center" mb="3">
        <Dialog.Title>Add Ingredient</Dialog.Title>
        <Dialog.Close>
          <IconButton variant="ghost">
            <Cross2Icon />
          </IconButton>
        </Dialog.Close>
      </Flex>

      <Flex direction="column" gap="3">
        <TextField.Root
          placeholder="Search ingredients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Tabs.Root value={selectedCategory} onValueChange={setSelectedCategory}>
          <Tabs.List>
            {categories.map((cat) => (
              <Tabs.Trigger
                key={cat}
                value={cat}
                style={{ textTransform: "capitalize" }}
              >
                {cat}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

        <Box style={{ height: "300px", overflow: "auto" }}>
          <Flex direction="column" gap="2">
            {ingredients.length === 0 ? (
              <Flex
                direction="column"
                gap="3"
                align="center"
                justify="center"
                style={{ height: "200px" }}
              >
                <Text color="gray" size="2">
                  No ingredients found
                </Text>
                {searchQuery && (
                  <>
                    <Button
                      onClick={onAISearch}
                      disabled={isAISearching || !searchQuery.trim()}
                      variant="soft"
                    >
                      <MagicWandIcon width="16" height="16" />
                      {isAISearching
                        ? "Searching with AI..."
                        : "Search with AI"}
                    </Button>
                    {aiSearchError && (
                      <Text
                        color="red"
                        size="2"
                        style={{ textAlign: "center" }}
                      >
                        {aiSearchError}
                      </Text>
                    )}
                  </>
                )}
              </Flex>
            ) : (
              ingredients.map((ingredient: Ingredient) => (
                <Card key={ingredient.id} size="1" asChild>
                  <button
                    type="button"
                    onClick={() => onAdd(ingredient)}
                    style={{ cursor: "pointer", textAlign: "left" }}
                  >
                    <Flex justify="between" align="center">
                      <Flex align="center" gap="2">
                        <Text size="3">
                          {getIngredientIcon(ingredient.name)}
                        </Text>
                        <Text>{ingredient.name}</Text>
                      </Flex>
                      <Text size="1" color="gray">
                        {ingredient.calories} kcal/100g • {ingredient.protein}g
                        pro
                      </Text>
                    </Flex>
                  </button>
                </Card>
              ))
            )}
          </Flex>
        </Box>
      </Flex>
    </Dialog.Content>
  );
}

function AISuggestionsPanel({
  suggestions,
  onClose,
}: {
  suggestions: Array<{ type: string; reason: string }>;
  onClose: () => void;
}) {
  return (
    <Card size="3" mb="4">
      <Flex justify="between" align="center" mb="3">
        <Heading size="4">AI Suggestions</Heading>
        <IconButton variant="ghost" onClick={onClose}>
          <Cross2Icon />
        </IconButton>
      </Flex>

      <Flex direction="column" gap="3">
        {suggestions.map((suggestion) => (
          <Card
            key={suggestion.reason}
            size="2"
            style={{ backgroundColor: "var(--gray-2)" }}
          >
            <Text>{suggestion.reason}</Text>
          </Card>
        ))}
      </Flex>
    </Card>
  );
}

function SaveTemplateDialog({
  onClose,
  selectedIngredients,
  fetcher,
}: {
  onClose: () => void;
  selectedIngredients: SelectedIngredient[];
  fetcher: ReturnType<typeof useFetcher>;
}) {
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState<
    "breakfast" | "lunch" | "dinner" | "snack"
  >("lunch");
  const [templateNotes, setTemplateNotes] = useState("");

  const handleSave = () => {
    if (!templateName) return;

    const ingredientsData = selectedIngredients.map((ing) => ({
      id: ing.id,
      quantity: ing.quantity,
    }));

    fetcher.submit(
      {
        intent: "save-template",
        name: templateName,
        category: templateCategory,
        notes: templateNotes,
        ingredients: JSON.stringify(ingredientsData),
      },
      { method: "post" },
    );

    onClose();
  };

  return (
    <AlertDialog.Content>
      <AlertDialog.Title>Save Meal Template</AlertDialog.Title>
      <AlertDialog.Description>
        Save this meal combination as a reusable template.
      </AlertDialog.Description>

      <Flex direction="column" gap="3" mt="4">
        <Box>
          <Text as="label" size="2" weight="medium" mb="1">
            Template Name *
          </Text>
          <TextField.Root
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., Post-workout meal"
          />
        </Box>

        <Box>
          <Text as="label" size="2" weight="medium" mb="1">
            Category
          </Text>
          <RadioGroup.Root
            value={templateCategory}
            onValueChange={(
              value: "breakfast" | "lunch" | "dinner" | "snack",
            ) => setTemplateCategory(value)}
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
            value={templateNotes}
            onChange={(e) => setTemplateNotes(e.target.value)}
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
          <Button onClick={handleSave} disabled={!templateName}>
            Save Template
          </Button>
        </AlertDialog.Action>
      </Flex>
    </AlertDialog.Content>
  );
}
