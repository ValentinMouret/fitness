import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Checkbox,
  Flex,
  Heading,
  Spinner,
  Text,
  TextArea,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { ImportResult } from "../../../domain/strong-import";
import "./StrongImportForm.css";

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

  const strongTextId = useId();
  const customImportTimeId = useId();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (formRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          formRef.current.requestSubmit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

        <form ref={formRef} onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            {/* Strong Text Input */}
            <Box>
              <Flex direction="column" gap="2">
                <Text
                  as="label"
                  htmlFor={strongTextId}
                  size="2"
                  weight="medium"
                >
                  Strong Workout Export
                </Text>
                <TextArea
                  ref={textAreaRef}
                  id={strongTextId}
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
              </Flex>
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
                <Flex direction="column" gap="2">
                  <Text
                    as="label"
                    htmlFor={customImportTimeId}
                    size="2"
                    weight="medium"
                  >
                    Custom Import Time
                  </Text>
                  <input
                    id={customImportTimeId}
                    type="datetime-local"
                    value={customImportTime}
                    onChange={(e) => setCustomImportTime(e.target.value)}
                    disabled={isSubmitting}
                    className="fitness-import-form__input"
                  />
                </Flex>
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
              <Tooltip content="Import workout (Cmd+Enter)">
                <Box display="inline-block">
                  <Button
                    type="submit"
                    disabled={!strongText.trim() || isSubmitting}
                    aria-keyshortcuts="Meta+Enter Control+Enter"
                  >
                    {isSubmitting && <Spinner size="1" />}
                    {isSubmitting ? "Importing..." : "Import Workout"}
                  </Button>
                </Box>
              </Tooltip>
            </Flex>
          </Flex>
        </form>
      </Flex>
    </Card>
  );
}
