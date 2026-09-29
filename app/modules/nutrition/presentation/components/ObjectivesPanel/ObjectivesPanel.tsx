import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { NumberInput } from "~/components/NumberInput";

export interface Objectives {
  readonly calories: number | null;
  readonly protein: number | null;
  readonly carbs: number | null;
  readonly fats: number | null;
}

interface ObjectivesPanelProps {
  readonly objectives: Objectives;
  readonly setObjectives: (obj: Objectives) => void;
}

export function ObjectivesPanel({
  objectives,
  setObjectives,
}: ObjectivesPanelProps) {
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
            <NumberInput
              allowDecimals={false}
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
            <NumberInput
              allowDecimals={false}
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
            <NumberInput
              allowDecimals={false}
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
            <NumberInput
              allowDecimals={false}
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
      </Flex>
    </Card>
  );
}
