import { Box, Button, Flex, Text } from "@radix-ui/themes";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";

interface EmptyMealCardProps {
  readonly mealType: MealCategory;
  readonly onUseTemplate: (mealType: MealCategory) => void;
}

export function EmptyMealCard({ mealType, onUseTemplate }: EmptyMealCardProps) {
  return (
    <Box>
      <Text size="2" color="gray" mb="4">
        No meal logged yet
      </Text>

      <Flex gap="2" wrap="wrap">
        <Button
          size="2"
          variant="outline"
          onClick={() => onUseTemplate(mealType)}
        >
          Use Template
        </Button>
      </Flex>
    </Box>
  );
}
