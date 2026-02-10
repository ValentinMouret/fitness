import { Cross2Icon, MagicWandIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  IconButton,
  RadioGroup,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useState } from "react";
import { NumberInput } from "~/components/NumberInput";
import {
  type CreateAIIngredientInput,
  type IngredientCategory,
  ingredientCategories,
  type TextureCategory,
  textureCategories,
} from "../../../domain/ingredient";

interface AIIngredientReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiIngredientData: CreateAIIngredientInput;
  onSave: (ingredientData: CreateAIIngredientInput) => void;
  isLoading?: boolean;
}

export function AIIngredientReviewModal({
  isOpen,
  onClose,
  aiIngredientData,
  onSave,
  isLoading = false,
}: AIIngredientReviewModalProps) {
  const [formData, setFormData] =
    useState<CreateAIIngredientInput>(aiIngredientData);

  const handleFieldChange = <K extends keyof CreateAIIngredientInput>(
    field: K,
    value: CreateAIIngredientInput[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumberFieldChange = (
    field: keyof CreateAIIngredientInput,
    value: string,
  ) => {
    const numValue = Number.parseFloat(value);
    if (!Number.isNaN(numValue)) {
      handleFieldChange(field, numValue as never);
    }
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content size="4">
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title>
            <Flex align="center" gap="2">
              <MagicWandIcon width="20" height="20" />
              Review AI-Found Ingredient
            </Flex>
          </Dialog.Title>
          <Dialog.Close>
            <IconButton variant="ghost">
              <Cross2Icon />
            </IconButton>
          </Dialog.Close>
        </Flex>

        <Text size="2" color="gray" mb="4">
          Please review and edit the ingredient data found by AI before adding
          it to the database.
        </Text>

        <Box style={{ maxHeight: "60vh", overflow: "auto" }}>
          <Grid columns="2" gap="4">
            {/* Basic Information */}
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Name *
              </Text>
              <TextField.Root
                value={formData.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Ingredient name"
              />
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Category *
              </Text>
              <Select.Root
                value={formData.category}
                onValueChange={(value) =>
                  handleFieldChange("category", value as IngredientCategory)
                }
              >
                <Select.Trigger />
                <Select.Content>
                  <Select.Group>
                    {ingredientCategories.map((category) => (
                      <Select.Item key={category} value={category}>
                        {category
                          .replace("_", " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Box>

            {/* Nutritional Information */}
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Calories (per 100g) *
              </Text>
              <NumberInput
                allowDecimals={false}
                value={formData.calories.toString()}
                onChange={(e) =>
                  handleNumberFieldChange("calories", e.target.value)
                }
                placeholder="0"
                min="0"
                max="900"
              />
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Protein (g per 100g) *
              </Text>
              <NumberInput
                value={formData.protein.toString()}
                onChange={(e) =>
                  handleNumberFieldChange("protein", e.target.value)
                }
                placeholder="0"
                min="0"
                max="100"
              />
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Carbs (g per 100g) *
              </Text>
              <NumberInput
                value={formData.carbs.toString()}
                onChange={(e) =>
                  handleNumberFieldChange("carbs", e.target.value)
                }
                placeholder="0"
                min="0"
                max="100"
              />
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Fat (g per 100g) *
              </Text>
              <NumberInput
                value={formData.fat.toString()}
                onChange={(e) => handleNumberFieldChange("fat", e.target.value)}
                placeholder="0"
                min="0"
                max="100"
              />
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Fiber (g per 100g) *
              </Text>
              <NumberInput
                value={formData.fiber.toString()}
                onChange={(e) =>
                  handleNumberFieldChange("fiber", e.target.value)
                }
                placeholder="0"
                min="0"
                max="50"
              />
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Water Percentage (%) *
              </Text>
              <NumberInput
                value={formData.waterPercentage.toString()}
                onChange={(e) =>
                  handleNumberFieldChange("waterPercentage", e.target.value)
                }
                placeholder="0"
                min="0"
                max="100"
              />
            </Box>

            {/* Additional Properties */}
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Energy Density (kcal/g) *
              </Text>
              <NumberInput
                value={formData.energyDensity.toString()}
                onChange={(e) =>
                  handleNumberFieldChange("energyDensity", e.target.value)
                }
                placeholder="0"
                min="0"
                max="9"
              />
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Texture *
              </Text>
              <Select.Root
                value={formData.texture}
                onValueChange={(value) =>
                  handleFieldChange("texture", value as TextureCategory)
                }
              >
                <Select.Trigger />
                <Select.Content>
                  <Select.Group>
                    {textureCategories.map((texture) => (
                      <Select.Item key={texture} value={texture}>
                        {texture
                          .replace("_", " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Box>

            {/* Portion Settings */}
            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Minimum Portion (g) *
              </Text>
              <NumberInput
                allowDecimals={false}
                value={formData.sliderMin.toString()}
                onChange={(e) =>
                  handleNumberFieldChange("sliderMin", e.target.value)
                }
                placeholder="1"
                min="1"
                max="500"
              />
            </Box>

            <Box>
              <Text as="label" size="2" weight="medium" mb="1">
                Maximum Portion (g) *
              </Text>
              <NumberInput
                allowDecimals={false}
                value={formData.sliderMax.toString()}
                onChange={(e) =>
                  handleNumberFieldChange("sliderMax", e.target.value)
                }
                placeholder="100"
                min={formData.sliderMin + 1}
                max="1000"
              />
            </Box>
          </Grid>

          {/* Dietary Preferences */}
          <Box mt="4">
            <Text as="label" size="2" weight="medium" mb="2">
              Dietary Properties
            </Text>
            <Card size="2">
              <Flex gap="6">
                <RadioGroup.Root
                  value={
                    formData.isVegetarian ? "vegetarian" : "not-vegetarian"
                  }
                  onValueChange={(value) =>
                    handleFieldChange("isVegetarian", value === "vegetarian")
                  }
                >
                  <Text size="2" weight="medium" mb="2">
                    Vegetarian
                  </Text>
                  <Flex gap="4">
                    <Flex align="center" gap="2">
                      <RadioGroup.Item value="vegetarian" />
                      <Text size="2">Yes</Text>
                    </Flex>
                    <Flex align="center" gap="2">
                      <RadioGroup.Item value="not-vegetarian" />
                      <Text size="2">No</Text>
                    </Flex>
                  </Flex>
                </RadioGroup.Root>

                <RadioGroup.Root
                  value={formData.isVegan ? "vegan" : "not-vegan"}
                  onValueChange={(value) =>
                    handleFieldChange("isVegan", value === "vegan")
                  }
                >
                  <Text size="2" weight="medium" mb="2">
                    Vegan
                  </Text>
                  <Flex gap="4">
                    <Flex align="center" gap="2">
                      <RadioGroup.Item value="vegan" />
                      <Text size="2">Yes</Text>
                    </Flex>
                    <Flex align="center" gap="2">
                      <RadioGroup.Item value="not-vegan" />
                      <Text size="2">No</Text>
                    </Flex>
                  </Flex>
                </RadioGroup.Root>
              </Flex>
            </Card>
          </Box>

          {/* Nutritional Preview */}
          <Box mt="4">
            <Text as="label" size="2" weight="medium" mb="2">
              Nutritional Preview (per 100g)
            </Text>
            <Card size="2">
              <Grid columns="4" gap="3">
                <Box>
                  <Text size="1" color="gray">
                    Calories
                  </Text>
                  <Text size="2" weight="bold">
                    {formData.calories} kcal
                  </Text>
                </Box>
                <Box>
                  <Text size="1" color="gray">
                    Protein
                  </Text>
                  <Text size="2" weight="bold">
                    {formData.protein}g
                  </Text>
                </Box>
                <Box>
                  <Text size="1" color="gray">
                    Carbs
                  </Text>
                  <Text size="2" weight="bold">
                    {formData.carbs}g
                  </Text>
                </Box>
                <Box>
                  <Text size="1" color="gray">
                    Fat
                  </Text>
                  <Text size="2" weight="bold">
                    {formData.fat}g
                  </Text>
                </Box>
              </Grid>
            </Card>
          </Box>
        </Box>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" onClick={onClose}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            onClick={handleSave}
            disabled={isLoading || !formData.name.trim()}
          >
            {isLoading ? "Adding..." : "Add to Database"}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
