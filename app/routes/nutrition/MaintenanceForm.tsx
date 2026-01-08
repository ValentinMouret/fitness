import { Button, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { Form } from "react-router";

interface Props {
  readonly age?: number;
  readonly height?: number;
  readonly weight?: number;
  readonly activity?: number;
  readonly delta?: number;
}

export default function MaintenanceForm({
  age,
  height,
  weight,
  activity,
  delta,
}: Props) {
  return (
    <Card size="3" mb="6">
      <Heading size="5" mb="4">
        Calculate Maintenance Calories
      </Heading>

      <Form>
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Age
            </Text>
            <TextField.Root
              name="age"
              type="number"
              inputMode="numeric"
              defaultValue={age ?? 30}
              min={10}
              step={1}
              placeholder="30"
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Height (cm)
            </Text>
            <TextField.Root
              name="height"
              type="number"
              inputMode="numeric"
              defaultValue={height ?? 180}
              min={0}
              step={1}
              placeholder="180"
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Weight (kg)
            </Text>
            <TextField.Root
              name="weight"
              type="number"
              inputMode="numeric"
              defaultValue={weight ?? 70}
              min={0}
              step={1}
              placeholder="70"
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Activity Level
            </Text>
            <TextField.Root
              name="activity"
              type="number"
              inputMode="decimal"
              defaultValue={activity ?? 1.4}
              step={0.1}
              min={0.8}
              max={2.0}
              placeholder="1.4"
            />
            <Text size="1" color="gray">
              Sedentary: 1.2 • Light activity: 1.4 • Moderate: 1.6 • Very
              active: 1.8
            </Text>
          </Flex>

          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Target Deficit/Surplus (%)
            </Text>
            <TextField.Root
              name="delta"
              type="number"
              inputMode="numeric"
              defaultValue={delta ?? 0}
              min={-15}
              max={15}
              step={1}
              placeholder="0"
            />
            <Text size="1" color="gray">
              Negative for weight loss (e.g., -10%), positive for weight gain
            </Text>
          </Flex>

          <Button type="submit" size="3" mt="2">
            Calculate
          </Button>
        </Flex>
      </Form>
    </Card>
  );
}
