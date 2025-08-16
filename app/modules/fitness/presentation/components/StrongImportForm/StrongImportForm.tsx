import { useState } from "react";
import {
  Card,
  Flex,
  Heading,
  Text,
  TextArea,
  Button,
  Checkbox,
  Box,
  Badge,
  Callout,
  Spinner,
} from "@radix-ui/themes";
import { useFetcher } from "react-router";
import type { ImportResult } from "../../../domain/strong-import";

interface StrongImportFormProps {
  onImportSuccess?: (result: ImportResult) => void;
  onCancel?: () => void;
}

export function StrongImportForm({
  onImportSuccess,
  onCancel,
}: StrongImportFormProps) {
  const [strongText, setStrongText] = useState("");
  const [createMissingExercises, setCreateMissingExercises] = useState(true);
  const [skipUnmappedExercises, setSkipUnmappedExercises] = useState(false);
  const [customImportTime, setCustomImportTime] = useState("");
  const [useCustomTime, setUseCustomTime] = useState(false);

  const fetcher = useFetcher<{
    success: boolean;
    result?: ImportResult;
    error?: string;
    unmappedExercises?: string[];
  }>();

  const isSubmitting = fetcher.state === "submitting";
  const hasError = fetcher.data?.success === false;
  const hasSuccess = fetcher.data?.success === true;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!strongText.trim()) {
      return;
    }

    const formData = new FormData();
    formData.append("strongText", strongText);
    formData.append("createMissingExercises", String(createMissingExercises));
    formData.append("skipUnmappedExercises", String(skipUnmappedExercises));

    if (useCustomTime && customImportTime) {
      formData.append("customImportTime", customImportTime);
    }

    fetcher.submit(formData, {
      method: "POST",
      action: "/workouts/import",
    });
  };

  // Handle successful import
  if (hasSuccess && fetcher.data?.result) {
    if (onImportSuccess) {
      onImportSuccess(fetcher.data.result);
      return null;
    }
  }

  return (
    <Card size="4">
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center">
          <Heading size="6">Import Workout from Strong</Heading>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Flex>

        <Text size="2" color="gray">
          Paste your Strong app workout export below. The import will
          automatically map exercises and create your workout.
        </Text>

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            {/* Strong Text Input */}
            <Box>
              <Text as="label" size="2" weight="medium" mb="2">
                Strong Workout Export
              </Text>
              <TextArea
                placeholder={`Early Morning Workout
Wednesday 13 August 2025 at 07:32

Bench Press (Dumbbell)
Set 1: 20 kg × 16
Set 2: 20 kg × 14

...`}
                value={strongText}
                onChange={(e) => setStrongText(e.target.value)}
                rows={12}
                required
                disabled={isSubmitting}
              />
            </Box>

            <Box>
              <Text size="2" weight="medium" mb="2">
                Import Options
              </Text>
              <Flex direction="column" gap="2">
                <Text as="label" size="2">
                  <Checkbox
                    checked={createMissingExercises}
                    onCheckedChange={(checked) =>
                      setCreateMissingExercises(checked === true)
                    }
                    disabled={isSubmitting}
                  />
                  <Text ml="2">Automatically create missing exercises</Text>
                </Text>

                <Text as="label" size="2">
                  <Checkbox
                    checked={skipUnmappedExercises}
                    onCheckedChange={(checked) =>
                      setSkipUnmappedExercises(checked === true)
                    }
                    disabled={isSubmitting}
                  />
                  <Text ml="2">
                    Skip exercises that can't be mapped (instead of failing)
                  </Text>
                </Text>

                <Text as="label" size="2">
                  <Checkbox
                    checked={useCustomTime}
                    onCheckedChange={(checked) =>
                      setUseCustomTime(checked === true)
                    }
                    disabled={isSubmitting}
                  />
                  <Text ml="2">Override import time</Text>
                </Text>
              </Flex>
            </Box>

            {useCustomTime && (
              <Box>
                <Text as="label" size="2" weight="medium" mb="2">
                  Custom Import Time
                </Text>
                <input
                  type="datetime-local"
                  value={customImportTime}
                  onChange={(e) => setCustomImportTime(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid var(--gray-7)",
                    borderRadius: "4px",
                    fontSize: "14px",
                    width: "100%",
                  }}
                />
              </Box>
            )}

            {hasError && fetcher.data?.error && (
              <Callout.Root color="red">
                <Callout.Icon />
                <Callout.Text>
                  <Text weight="bold">Import Failed</Text>
                  <Text>{fetcher.data.error}</Text>
                </Callout.Text>
              </Callout.Root>
            )}

            {hasSuccess && fetcher.data?.result && (
              <Callout.Root color="green">
                <Callout.Icon />
                <Callout.Text>
                  <Text weight="bold" mb="2">
                    Import Successful!
                  </Text>
                  <Flex direction="column" gap="2">
                    <Text>Your workout has been imported successfully.</Text>
                    {fetcher.data.result.exercisesCreated.length > 0 && (
                      <Flex align="center" gap="2">
                        <Badge color="blue">
                          {fetcher.data.result.exercisesCreated.length} new
                          exercises created
                        </Badge>
                      </Flex>
                    )}
                    {fetcher.data.result.warnings.length > 0 && (
                      <Box>
                        <Text size="2" color="orange">
                          Warnings:
                        </Text>
                        {fetcher.data.result.warnings.map((warning) => (
                          <Text
                            key={warning}
                            size="1"
                            color="orange"
                            ml="2"
                            as="div"
                          >
                            • {warning}
                          </Text>
                        ))}
                      </Box>
                    )}
                  </Flex>
                </Callout.Text>
              </Callout.Root>
            )}

            {fetcher.data?.unmappedExercises &&
              fetcher.data.unmappedExercises.length > 0 && (
                <Callout.Root color="orange">
                  <Callout.Icon />
                  <Callout.Text>
                    <Text weight="bold" mb="2">
                      Some Exercises Need Mapping
                    </Text>
                    <Text mb="2">
                      The following exercises couldn't be automatically mapped:
                    </Text>
                    {fetcher.data.unmappedExercises.map((exercise) => (
                      <Badge key={exercise} color="orange" mr="1" mb="1">
                        {exercise}
                      </Badge>
                    ))}
                    <Text size="2" color="gray" mt="2">
                      You can manually map these exercises after import or
                      enable "Create missing exercises" option.
                    </Text>
                  </Callout.Text>
                </Callout.Root>
              )}

            <Flex justify="end" gap="3" pt="2">
              {onCancel && (
                <Button
                  type="button"
                  variant="soft"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={!strongText.trim() || isSubmitting}
              >
                {isSubmitting && <Spinner size="1" />}
                {isSubmitting ? "Importing..." : "Import Workout"}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Flex>
    </Card>
  );
}
