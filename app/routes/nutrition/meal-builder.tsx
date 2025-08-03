import { useState, useMemo } from "react";
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
  Slider,
  Tabs,
  Text,
  TextField,
  Progress,
  AlertDialog,
  Badge,
} from "@radix-ui/themes";
import {
  ChevronLeftIcon,
  Cross2Icon,
  PlusIcon,
  MagicWandIcon,
  DownloadIcon,
} from "@radix-ui/react-icons";
import { Link } from "react-router";

// Mock ingredient data
const INGREDIENT_LIBRARY = [
  // Proteins
  {
    id: "chicken-breast",
    name: "Chicken Breast",
    category: "protein",
    texture: "firm-solid",
    icon: "🍗",
    calories: 120,
    protein: 25,
    carbs: 0,
    fat: 2.5,
    fiber: 0,
    defaultRange: [0, 300],
    unit: "g",
  },
  {
    id: "beef-lean",
    name: "Beef, Lean Ground",
    category: "protein",
    texture: "firm-solid",
    icon: "🥩",
    calories: 250,
    protein: 26,
    carbs: 0,
    fat: 15,
    fiber: 0,
    defaultRange: [0, 300],
    unit: "g",
  },
  {
    id: "eggs",
    name: "Eggs, Whole",
    category: "protein",
    texture: "soft-solid",
    icon: "🥚",
    calories: 155,
    protein: 13,
    carbs: 1.1,
    fat: 11,
    fiber: 0,
    defaultRange: [0, 200],
    unit: "g",
  },
  {
    id: "tofu",
    name: "Tofu, Firm",
    category: "protein",
    texture: "soft-solid",
    icon: "🧊",
    calories: 144,
    protein: 15,
    carbs: 3.5,
    fat: 8.7,
    fiber: 2.8,
    defaultRange: [0, 250],
    unit: "g",
  },
  {
    id: "salmon",
    name: "Salmon, Atlantic",
    category: "protein",
    texture: "firm-solid",
    icon: "🐟",
    calories: 208,
    protein: 20,
    carbs: 0,
    fat: 13,
    fiber: 0,
    defaultRange: [0, 250],
    unit: "g",
  },
  {
    id: "greek-yogurt",
    name: "Greek Yogurt",
    category: "dairy",
    texture: "semi-liquid",
    icon: "🥛",
    calories: 100,
    protein: 10,
    carbs: 6,
    fat: 0,
    fiber: 0,
    defaultRange: [0, 300],
    unit: "g",
  },

  // Carbs
  {
    id: "white-rice",
    name: "White Rice, Cooked",
    category: "carbs",
    texture: "soft-solid",
    icon: "🍚",
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    fiber: 0.4,
    defaultRange: [0, 300],
    unit: "g",
  },
  {
    id: "brown-rice",
    name: "Brown Rice, Cooked",
    category: "carbs",
    texture: "soft-solid",
    icon: "🍚",
    calories: 112,
    protein: 2.6,
    carbs: 23,
    fat: 0.9,
    fiber: 1.8,
    defaultRange: [0, 300],
    unit: "g",
  },
  {
    id: "pasta",
    name: "Pasta, Cooked",
    category: "carbs",
    texture: "soft-solid",
    icon: "🍝",
    calories: 131,
    protein: 5,
    carbs: 25,
    fat: 1.1,
    fiber: 1.8,
    defaultRange: [0, 300],
    unit: "g",
  },
  {
    id: "oats",
    name: "Oats, Rolled",
    category: "carbs",
    texture: "soft-solid",
    icon: "🥣",
    calories: 379,
    protein: 13.2,
    carbs: 67.7,
    fat: 6.5,
    fiber: 10.1,
    defaultRange: [0, 150],
    unit: "g",
  },
  {
    id: "sweet-potato",
    name: "Sweet Potato",
    category: "carbs",
    texture: "firm-solid",
    icon: "🍠",
    calories: 86,
    protein: 1.6,
    carbs: 20,
    fat: 0.1,
    fiber: 3,
    defaultRange: [0, 300],
    unit: "g",
  },
  {
    id: "quinoa",
    name: "Quinoa, Cooked",
    category: "carbs",
    texture: "soft-solid",
    icon: "🌾",
    calories: 120,
    protein: 4.4,
    carbs: 21,
    fat: 1.9,
    fiber: 2.8,
    defaultRange: [0, 250],
    unit: "g",
  },

  // Vegetables
  {
    id: "broccoli",
    name: "Broccoli, Steamed",
    category: "vegetables",
    texture: "firm-solid",
    icon: "🥦",
    calories: 34,
    protein: 2.8,
    carbs: 7,
    fat: 0.4,
    fiber: 2.6,
    defaultRange: [0, 300],
    unit: "g",
  },
  {
    id: "spinach",
    name: "Spinach, Raw",
    category: "vegetables",
    texture: "soft-solid",
    icon: "🥬",
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
    fiber: 2.2,
    defaultRange: [0, 200],
    unit: "g",
  },
  {
    id: "bell-pepper",
    name: "Bell Pepper",
    category: "vegetables",
    texture: "firm-solid",
    icon: "🫑",
    calories: 31,
    protein: 1,
    carbs: 6,
    fat: 0.3,
    fiber: 2.1,
    defaultRange: [0, 250],
    unit: "g",
  },
  {
    id: "carrots",
    name: "Carrots",
    category: "vegetables",
    texture: "firm-solid",
    icon: "🥕",
    calories: 41,
    protein: 0.9,
    carbs: 10,
    fat: 0.2,
    fiber: 2.8,
    defaultRange: [0, 200],
    unit: "g",
  },
  {
    id: "tomatoes",
    name: "Tomatoes",
    category: "vegetables",
    texture: "soft-solid",
    icon: "🍅",
    calories: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
    fiber: 1.2,
    defaultRange: [0, 250],
    unit: "g",
  },

  // Fats
  {
    id: "olive-oil",
    name: "Olive Oil",
    category: "fats",
    texture: "liquid",
    icon: "🫒",
    calories: 884,
    protein: 0,
    carbs: 0,
    fat: 100,
    fiber: 0,
    defaultRange: [0, 50],
    unit: "g",
  },
  {
    id: "avocado",
    name: "Avocado",
    category: "fats",
    texture: "soft-solid",
    icon: "🥑",
    calories: 160,
    protein: 2,
    carbs: 9,
    fat: 15,
    fiber: 7,
    defaultRange: [0, 200],
    unit: "g",
  },
  {
    id: "almonds",
    name: "Almonds",
    category: "fats",
    texture: "firm-solid",
    icon: "🌰",
    calories: 579,
    protein: 21,
    carbs: 22,
    fat: 50,
    fiber: 12.5,
    defaultRange: [0, 100],
    unit: "g",
  },
  {
    id: "peanut-butter",
    name: "Peanut Butter",
    category: "fats",
    texture: "semi-liquid",
    icon: "🥜",
    calories: 588,
    protein: 25,
    carbs: 20,
    fat: 50,
    fiber: 6,
    defaultRange: [0, 100],
    unit: "g",
  },

  // Dairy
  {
    id: "milk",
    name: "Milk, Whole",
    category: "dairy",
    texture: "liquid",
    icon: "🥛",
    calories: 61,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.3,
    fiber: 0,
    defaultRange: [0, 500],
    unit: "ml",
  },
  {
    id: "cheese",
    name: "Cheddar Cheese",
    category: "dairy",
    texture: "firm-solid",
    icon: "🧀",
    calories: 402,
    protein: 25,
    carbs: 1.3,
    fat: 33,
    fiber: 0,
    defaultRange: [0, 150],
    unit: "g",
  },
];

const TEXTURE_LABELS = {
  liquid: "💧 Liquid",
  "semi-liquid": "🥤 Semi-liquid",
  "soft-solid": "🍮 Soft solid",
  "firm-solid": "🥩 Firm solid",
};

interface Ingredient {
  id: string;
  name: string;
  category: string;
  texture: string;
  icon: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  defaultRange: [number, number];
  unit: string;
}

interface SelectedIngredient extends Ingredient {
  quantity: number;
}

interface Objectives {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  satiety: number;
}

export default function MealBuilder() {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Calculate totals
  const totals = useMemo(() => {
    return selectedIngredients.reduce(
      (acc, ing) => {
        const factor = ing.quantity / 100;
        return {
          calories: acc.calories + ing.calories * factor,
          protein: acc.protein + ing.protein * factor,
          carbs: acc.carbs + ing.carbs * factor,
          fat: acc.fat + ing.fat * factor,
          fiber: acc.fiber + ing.fiber * factor,
          volume: acc.volume + ing.quantity,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, volume: 0 },
    );
  }, [selectedIngredients]);

  // Mock satiety calculation
  const satietyScore = useMemo(() => {
    const proteinPoints = totals.protein * 0.4;
    const fiberPoints = totals.fiber * 0.3;
    const volumePoints = (totals.volume / 100) * 0.2;
    const total = proteinPoints + fiberPoints + volumePoints;

    if (total < 10) return 1;
    if (total < 20) return 2;
    if (total < 30) return 3;
    if (total < 40) return 4;
    return 5;
  }, [totals]);

  const satietyDuration: Record<number, string> = {
    1: "~1-2 hours",
    2: "~2-3 hours",
    3: "~3-4 hours",
    4: "~4-5 hours",
    5: "~5+ hours",
  };

  // Filter ingredients for modal
  const filteredIngredients = INGREDIENT_LIBRARY.filter((ing) => {
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
      const greekYogurt = INGREDIENT_LIBRARY.find(
        (i) => i.id === "greek-yogurt",
      );
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
  }, [objectives, totals, satietyScore]);

  const handleAddIngredient = (ingredient: Ingredient) => {
    const midpoint =
      (ingredient.defaultRange[0] + ingredient.defaultRange[1]) / 2;
    setSelectedIngredients([
      ...selectedIngredients,
      { ...ingredient, quantity: midpoint },
    ]);
    setIsAddModalOpen(false);
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    setSelectedIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, quantity } : ing)),
    );
  };

  const handleRemoveIngredient = (id: string) => {
    setSelectedIngredients((prev) => prev.filter((ing) => ing.id !== id));
  };

  return (
    <Container size="4">
      <Flex align="center" gap="3" mb="6">
        <Link to="/nutrition">
          <IconButton variant="ghost" size="2">
            <ChevronLeftIcon width="16" height="16" />
          </IconButton>
        </Link>
        <Heading size="6">Meal Builder</Heading>
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
          satietyDuration={satietyDuration[satietyScore]}
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
          />
        </Dialog.Root>

        <Button
          variant="outline"
          onClick={() => setShowAISuggestions(!showAISuggestions)}
        >
          <MagicWandIcon width="16" height="16" />
          AI Suggest
        </Button>

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
          <SaveTemplateDialog onClose={() => setShowSaveDialog(false)} />
        </AlertDialog.Root>
      </Flex>

      {showAISuggestions && (
        <AISuggestionsPanel
          suggestions={aiSuggestions}
          onClose={() => setShowAISuggestions(false)}
        />
      )}
    </Container>
  );
}

function ObjectivesPanel({
  objectives,
  setObjectives,
}: { objectives: Objectives; setObjectives: (obj: Objectives) => void }) {
  return (
    <Card size="3">
      <Heading size="4" mb="3">
        Set Your Objectives
      </Heading>

      <Flex direction="column" gap="3">
        <Box>
          <Text as="label" size="2" weight="medium" mb="1">
            Calories
          </Text>
          <Flex align="center" gap="2">
            <TextField.Root
              type="number"
              value={objectives.calories?.toString() || ""}
              onChange={(e) =>
                setObjectives({
                  ...objectives,
                  calories: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Enter calories"
            />
            <Text size="2">kcal</Text>
          </Flex>
        </Box>

        <Box>
          <Text as="label" size="2" weight="medium" mb="1">
            Protein
          </Text>
          <Flex align="center" gap="2">
            <TextField.Root
              type="number"
              value={objectives.protein?.toString() || ""}
              onChange={(e) =>
                setObjectives({
                  ...objectives,
                  protein: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Enter protein"
            />
            <Text size="2">g</Text>
          </Flex>
        </Box>

        <Box>
          <Text as="label" size="2" weight="medium" mb="1">
            Carbs
          </Text>
          <Flex align="center" gap="2">
            <TextField.Root
              type="number"
              value={objectives.carbs?.toString() || ""}
              onChange={(e) =>
                setObjectives({
                  ...objectives,
                  carbs: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Enter carbs"
            />
            <Text size="2">g</Text>
          </Flex>
        </Box>

        <Box>
          <Text as="label" size="2" weight="medium" mb="1">
            Fats
          </Text>
          <Flex align="center" gap="2">
            <TextField.Root
              type="number"
              value={objectives.fats?.toString() || ""}
              onChange={(e) =>
                setObjectives({
                  ...objectives,
                  fats: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Enter fats"
            />
            <Text size="2">g</Text>
          </Flex>
        </Box>

        <Box>
          <Text as="label" size="2" weight="medium" mb="2">
            Desired Satiety (1-5)
          </Text>
          <RadioGroup.Root
            value={objectives.satiety.toString()}
            onValueChange={(value) =>
              setObjectives({ ...objectives, satiety: Number(value) })
            }
          >
            <Flex direction="column" gap="2">
              <Flex gap="3" align="center" justify="center">
                {[1, 2, 3, 4, 5].map((level) => (
                  <Flex key={level} direction="column" align="center" gap="1">
                    <RadioGroup.Item value={level.toString()} />
                    <Text size="1">{level}</Text>
                  </Flex>
                ))}
              </Flex>
              <Flex justify="between" px="2">
                <Text size="1" color="gray">
                  Light
                </Text>
                <Text size="1" color="gray">
                  Moderate
                </Text>
                <Text size="1" color="gray">
                  Very Full
                </Text>
              </Flex>
            </Flex>
          </RadioGroup.Root>
        </Box>
      </Flex>
    </Card>
  );
}

function CurrentTotalsPanel({
  objectives,
  totals,
  satietyScore,
  satietyDuration,
}: any) {
  const getProgress = (current: number, target: number | null) => {
    if (!target) return 0;
    return (current / target) * 100;
  };

  const getProgressColor = (current: number, target: number | null) => {
    if (!target) return "var(--gray-6)";
    const percentage = (current / target) * 100;
    if (percentage < 33) return "var(--red-9)";
    if (percentage < 66) return "var(--yellow-9)";
    if (percentage <= 120) return "var(--green-9)";
    return "var(--red-9)"; // Over 120% shows red
  };

  const formatProgress = (current: number, target: number | null) => {
    if (!target) return `${Math.round(current)}`;
    return `${Math.round(current)}/${target}`;
  };

  const MacroProgressBar = ({ current, target, label, unit, size = "normal" }: { current: number; target: number | null; label: string; unit: string; size?: "normal" | "large" }) => {
    const progress = target ? getProgress(current, target) : 0;
    const color = target ? getProgressColor(current, target) : "var(--blue-9)";
    
    // For visual display: if no target, show current value as a proportion of a reasonable max
    // Use different reasonable maxes for different macros
    const getReasonableMax = () => {
      if (label === "Calories") return 3000;
      if (label === "Protein") return 200;
      if (label === "Carbs") return 400;
      if (label === "Fats") return 150;
      return 100;
    };
    
    const displayProgress = target 
      ? Math.min(progress, 120) 
      : Math.min((current / getReasonableMax()) * 100, 100); // Show current value as % of reasonable max

    return (
      <Box>
        <Flex justify="between" mb="1">
          <Text size={size === "large" ? "3" : "2"} weight={size === "large" ? "medium" : "normal"}>
            {target ? formatProgress(current, target) : label + ": " + Math.round(current)} {unit}
          </Text>
          {target && (
            <Text size="2">
              {Math.round(progress)}%
            </Text>
          )}
        </Flex>
        <Box style={{ position: "relative", width: "100%", height: size === "large" ? "12px" : "8px", backgroundColor: "var(--gray-4)", borderRadius: "6px", overflow: "hidden" }}>
          <Box
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${displayProgress}%`,
              backgroundColor: color,
              borderRadius: "6px",
              transition: "width 0.3s ease, background-color 0.3s ease",
            }}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Card size="3">
      <Heading size="4" mb="3">
        Current Totals
      </Heading>

      <Flex direction="column" gap="3">
        <MacroProgressBar
          current={totals.calories}
          target={objectives.calories}
          label="Calories"
          unit="kcal"
          size="large"
        />

        <MacroProgressBar
          current={totals.protein}
          target={objectives.protein}
          label="Protein"
          unit="g"
        />

        <MacroProgressBar
          current={totals.carbs}
          target={objectives.carbs}
          label="Carbs"
          unit="g"
        />

        <MacroProgressBar
          current={totals.fat}
          target={objectives.fats}
          label="Fats"
          unit="g"
        />

        <Box>
          <Text size="2">Fiber: {Math.round(totals.fiber * 10) / 10}g</Text>
        </Box>

        <Card size="2" mt="2">
          <Heading size="3" mb="2">
            Satiety Prediction
          </Heading>
          <Flex align="center" gap="2" mb="1">
            <Flex gap="1">
              {[1, 2, 3, 4, 5].map((level) => (
                <Text key={level} size="4" style={{ color: level <= satietyScore ? "var(--green-9)" : "var(--gray-6)" }}>
                  ●
                </Text>
              ))}
            </Flex>
            <Text size="3" weight="medium">
              {["", "Low", "Light", "Moderate", "High", "Very High"][satietyScore]} ({satietyScore}/5)
            </Text>
          </Flex>
          <Text size="2">{satietyDuration} fullness</Text>
          <Text size="2" color="gray">
            Volume: ~{Math.round(totals.volume)}ml
          </Text>
        </Card>
      </Flex>
    </Card>
  );
}

function IngredientCard({
  ingredient,
  onUpdateQuantity,
  onRemove,
}: {
  ingredient: SelectedIngredient;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}) {
  const nutritionFactor = ingredient.quantity / 100;
  const nutrition = {
    calories: Math.round(ingredient.calories * nutritionFactor),
    protein: Math.round(ingredient.protein * nutritionFactor * 10) / 10,
    carbs: Math.round(ingredient.carbs * nutritionFactor * 10) / 10,
    fat: Math.round(ingredient.fat * nutritionFactor * 10) / 10,
    fiber: Math.round(ingredient.fiber * nutritionFactor * 10) / 10,
  };

  const textureKey = ingredient.texture as keyof typeof TEXTURE_LABELS;

  return (
    <Card size="2">
      <Flex justify="between" align="center" mb="3">
        <Flex align="center" gap="2">
          <Text size="4">{ingredient.icon}</Text>
          <Text weight="medium">{ingredient.name}</Text>
          <Badge size="1" color="gray">
            {TEXTURE_LABELS[textureKey]}
          </Badge>
        </Flex>
        <IconButton variant="ghost" onClick={() => onRemove(ingredient.id)}>
          <Cross2Icon />
        </IconButton>
      </Flex>

      <Box mb="3">
        <Slider
          value={[ingredient.quantity]}
          onValueChange={(value: number[]) =>
            onUpdateQuantity(ingredient.id, value[0])
          }
          min={ingredient.defaultRange[0]}
          max={ingredient.defaultRange[1]}
          step={5}
        />
        <Flex justify="center" mt="2">
          <Text weight="bold">
            {ingredient.quantity}
            {ingredient.unit}
          </Text>
        </Flex>
      </Box>

      <Text size="1" color="gray">
        {nutrition.calories} kcal • {nutrition.protein}g protein •{" "}
        {nutrition.carbs}g carbs • {nutrition.fat}g fat
        {nutrition.fiber > 0 && ` • ${nutrition.fiber}g fiber`}
      </Text>
    </Card>
  );
}

function AddIngredientModal({
  ingredients,
  onAdd,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
}: any) {
  const categories = ["all", "protein", "carbs", "vegetables", "fats", "dairy"];

  return (
    <Dialog.Content size="3">
      <Dialog.Title>Add Ingredient</Dialog.Title>
      <Dialog.Close>
        <IconButton variant="ghost">
          <Cross2Icon />
        </IconButton>
      </Dialog.Close>

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
          {ingredients.map((ingredient: Ingredient) => (
            <Card key={ingredient.id} size="1" asChild>
              <button
                onClick={() => onAdd(ingredient)}
                style={{ cursor: "pointer", textAlign: "left" }}
              >
                <Flex justify="between" align="center">
                  <Flex align="center" gap="2">
                    <Text size="3">{ingredient.icon}</Text>
                    <Text>{ingredient.name}</Text>
                  </Flex>
                  <Text size="1" color="gray">
                    {ingredient.calories} kcal/100g • {ingredient.protein}g pro
                  </Text>
                </Flex>
              </button>
            </Card>
          ))}
          </Flex>
        </Box>
      </Flex>
    </Dialog.Content>
  );
}

function AISuggestionsPanel({ suggestions, onClose }: any) {
  return (
    <Card size="3" mb="4">
      <Flex justify="between" align="center" mb="3">
        <Heading size="4">AI Suggestions</Heading>
        <IconButton variant="ghost" onClick={onClose}>
          <Cross2Icon />
        </IconButton>
      </Flex>

      <Flex direction="column" gap="3">
        {suggestions.map((suggestion: any, index: number) => (
          <Card
            key={index}
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

function SaveTemplateDialog({ onClose }: { onClose: () => void }) {
  return (
    <AlertDialog.Content>
      <AlertDialog.Title>Template Saved!</AlertDialog.Title>
      <AlertDialog.Description>
        Your meal template has been successfully saved. You can find it in your
        saved templates list.
      </AlertDialog.Description>
      <Flex gap="3" mt="4" justify="end">
        <AlertDialog.Action>
          <Button onClick={onClose}>OK</Button>
        </AlertDialog.Action>
      </Flex>
    </AlertDialog.Content>
  );
}
