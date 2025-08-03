import { Box, Flex, Text } from "@radix-ui/themes";
import type { MealCardViewModel } from "../../view-models/meal-card.view-model";

interface MealCardProps {
  readonly viewModel: MealCardViewModel;
}

export function MealCard({ viewModel }: MealCardProps) {
  return (
    <Box>
      <Flex justify="between" align="center" mb="3">
        <Flex align="center" gap="2">
          {viewModel.statusIcon && <Text size="2">{viewModel.statusIcon}</Text>}
          <Text weight="medium">{viewModel.displayName}</Text>
        </Flex>
        <Text size="1" color="gray">
          {viewModel.timeAgo}
        </Text>
      </Flex>

      <Text size="2" color="gray" mb="3">
        {viewModel.nutrition.calories} kcal • {viewModel.nutrition.protein}g
        protein • {viewModel.nutrition.carbs}g carbs • {viewModel.nutrition.fat}
        g fat
      </Text>

      <Box style={{ borderTop: "1px solid var(--gray-6)", paddingTop: "12px" }}>
        {viewModel.ingredients.map((ingredient) => (
          <Flex key={ingredient.id} align="center" gap="2" mb="2">
            <Text size="2">{ingredient.icon}</Text>
            <Text size="2">
              {ingredient.name} ({ingredient.quantity})
            </Text>
          </Flex>
        ))}
      </Box>
    </Box>
  );
}
