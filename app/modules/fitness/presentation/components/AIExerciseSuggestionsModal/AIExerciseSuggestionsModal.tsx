import { CheckIcon, Cross2Icon, MagicWandIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Spinner,
  Text,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { SuggestedExercise } from "~/modules/fitness/domain/ai-generation";
import {
  type ExerciseType,
  exerciseTypes,
} from "~/modules/fitness/domain/workout";
import { ExerciseTypeBadge } from "../ExerciseTypeBadge";

interface AIExerciseSuggestionsModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function AIExerciseSuggestionsModal({
  open,
  onOpenChange,
}: AIExerciseSuggestionsModalProps) {
  const suggestFetcher = useFetcher<{
    intent?: string;
    suggestions?: SuggestedExercise[];
    error?: string;
  }>();
  const addFetcher = useFetcher();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [seenIds, setSeenIds] = useState<ReadonlyArray<string>>([]);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      suggestFetcher.submit(
        { intent: "suggest-exercises" },
        { method: "post" },
      );
    }
  }, [open, suggestFetcher.submit]);

  const suggestions: ReadonlyArray<SuggestedExercise> =
    suggestFetcher.data?.intent === "suggest-exercises" &&
    suggestFetcher.data.suggestions
      ? suggestFetcher.data.suggestions
      : [];

  const isLoading = suggestFetcher.state !== "idle";
  const error = suggestFetcher.data?.error;

  const handleToggle = (exerciseId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  };

  const handleReset = () => {
    const currentIds = suggestions.map((s) => s.exerciseId);
    const newSeenIds = [...seenIds, ...currentIds];
    setSeenIds(newSeenIds);
    setSelectedIds(new Set());

    const formData = new FormData();
    formData.set("intent", "suggest-exercises");
    for (const id of newSeenIds) {
      formData.append("excludedExerciseIds", id);
    }
    suggestFetcher.submit(formData, { method: "post" });
  };

  const handleGo = () => {
    if (selectedIds.size === 0) return;
    const formData = new FormData();
    formData.set("intent", "add-exercises");
    for (const id of selectedIds) {
      formData.append("exerciseIds", id);
    }
    addFetcher.submit(formData, { method: "post" });
    onOpenChange(false);
  };

  const selectedCount = selectedIds.size;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Flex justify="between" align="center" mb="1">
          <Flex align="center" gap="2">
            <MagicWandIcon />
            <Heading size="4">AI Suggestions</Heading>
          </Flex>
          <Dialog.Close>
            <IconButton variant="ghost" size="1" aria-label="Close">
              <Cross2Icon />
            </IconButton>
          </Dialog.Close>
        </Flex>

        <Dialog.Description size="2" color="gray" mb="4">
          Select exercises to add to your workout.
        </Dialog.Description>

        {isLoading && (
          <Flex
            align="center"
            justify="center"
            py="8"
            gap="3"
            direction="column"
          >
            <Spinner size="3" />
            <Text size="2" color="gray">
              Finding the best exercises for you…
            </Text>
          </Flex>
        )}

        {!isLoading && error && (
          <Text size="2" color="red">
            {error}
          </Text>
        )}

        {!isLoading && suggestions.length > 0 && (
          <Flex direction="column" gap="3">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.exerciseId}
                suggestion={suggestion}
                selected={selectedIds.has(suggestion.exerciseId)}
                onToggle={() => handleToggle(suggestion.exerciseId)}
              />
            ))}
          </Flex>
        )}

        <Flex gap="2" justify="end" mt="4">
          <Button
            variant="soft"
            color="gray"
            onClick={handleReset}
            disabled={isLoading}
          >
            Reset
          </Button>
          <Button
            onClick={handleGo}
            disabled={selectedCount === 0 || isLoading}
            loading={addFetcher.state !== "idle"}
          >
            Add{" "}
            {selectedCount > 0
              ? `${selectedCount} Exercise${selectedCount > 1 ? "s" : ""}`
              : "Selected"}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

interface SuggestionCardProps {
  readonly suggestion: SuggestedExercise;
  readonly selected: boolean;
  readonly onToggle: () => void;
}

function SuggestionCard({
  suggestion,
  selected,
  onToggle,
}: SuggestionCardProps) {
  const exerciseType = exerciseTypes.includes(
    suggestion.exerciseType as ExerciseType,
  )
    ? (suggestion.exerciseType as ExerciseType)
    : null;

  return (
    <Card
      onClick={onToggle}
      style={{
        cursor: "pointer",
        outline: selected ? "2px solid var(--accent-9)" : "none",
        outlineOffset: "1px",
      }}
    >
      <Flex direction="column" gap="2">
        <Flex justify="between" align="center" gap="2">
          <Text weight="bold" size="3">
            {suggestion.exerciseName}
          </Text>
          <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
            {exerciseType ? (
              <ExerciseTypeBadge type={exerciseType} />
            ) : (
              <Badge size="1" variant="soft">
                {suggestion.exerciseType}
              </Badge>
            )}
            {selected && <CheckIcon color="var(--accent-9)" />}
          </Flex>
        </Flex>

        <Text size="2" color="gray">
          {suggestion.rationale}
        </Text>

        {suggestion.muscleGroups.length > 0 && (
          <Flex gap="1" wrap="wrap">
            {suggestion.muscleGroups.map((mg) => (
              <Badge key={mg} size="1" variant="soft" color="gray">
                {mg}
              </Badge>
            ))}
          </Flex>
        )}
      </Flex>
    </Card>
  );
}
