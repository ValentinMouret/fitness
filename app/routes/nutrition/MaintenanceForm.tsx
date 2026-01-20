import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { NumberInput } from "~/components/NumberInput";
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
            <NumberInput
              name="age"
              allowDecimals={false}
              defaultValue={age ?? 30}
              min={10}
              placeholder="30"
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Height (cm)
            </Text>
            <NumberInput
              name="height"
              allowDecimals={false}
              defaultValue={height ?? 180}
              min={0}
              placeholder="180"
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Weight (kg)
            </Text>
            <NumberInput
              name="weight"
              allowDecimals={false}
              defaultValue={weight ?? 70}
              min={0}
              placeholder="70"
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Activity Level
            </Text>
            <NumberInput
              name="activity"
              defaultValue={activity ?? 1.4}
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
            <NumberInput
              name="delta"
              allowDecimals={false}
              defaultValue={delta ?? 0}
              min={-15}
              max={15}
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
