import { Cross2Icon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Card,
  Flex,
  IconButton,
  Slider,
  Text,
} from "@radix-ui/themes";
import type { Ingredient } from "~/modules/nutrition/domain/ingredient";

export interface SelectedIngredient extends Ingredient {
  readonly quantity: number;
  readonly defaultRange: readonly [number, number];
  readonly unit: string;
}

interface IngredientCardProps {
  readonly ingredient: SelectedIngredient;
  readonly onUpdateQuantity: (id: string, quantity: number) => void;
  readonly onRemove: (id: string) => void;
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

export function IngredientCard({
  ingredient,
  onUpdateQuantity,
  onRemove,
}: IngredientCardProps) {
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
          <Text size="4">{getIngredientIcon(ingredient.name)}</Text>
          <Text weight="medium">{ingredient.name}</Text>
          <Badge size="1" color="gray">
            {TEXTURE_LABELS[textureKey]}
          </Badge>
        </Flex>
        <IconButton
          variant="ghost"
          onClick={() => onRemove(ingredient.id)}
          aria-label="Remove ingredient"
        >
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
