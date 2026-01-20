import { Box, Card, Flex, Heading, RadioGroup, Text } from "@radix-ui/themes";
import { NumberInput } from "~/components/NumberInput";

export interface Objectives {
  readonly calories: number | null;
  readonly protein: number | null;
  readonly carbs: number | null;
  readonly fats: number | null;
  readonly satiety: number;
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
