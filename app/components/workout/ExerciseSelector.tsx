import { CheckIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  ScrollArea,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import Fuse from "fuse.js";
import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import type { Exercise, ExerciseType } from "~/modules/fitness/domain/workout";

interface ExerciseSelectorProps {
  readonly exercises: ReadonlyArray<Exercise>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly replaceExerciseId?: string;
}

export function ExerciseSelector({
  exercises,
  open,
  onOpenChange,
  replaceExerciseId,
}: ExerciseSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ExerciseType | "all">("all");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );
  const [selectedExercises, setSelectedExercises] = useState<
    ReadonlyArray<Exercise>
  >([]);
  const fetcher = useFetcher();

  const typeFiltered = useMemo(() => {
    if (selectedType === "all") return exercises;
    return exercises.filter((exercise) => exercise.type === selectedType);
  }, [exercises, selectedType]);

  const fuse = useMemo(
    () =>
      new Fuse(typeFiltered, {
        keys: ["name"],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [typeFiltered],
  );

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return typeFiltered;
    return fuse.search(searchQuery).map((result) => result.item);
  }, [typeFiltered, fuse, searchQuery]);

  const isReplaceMode = !!replaceExerciseId;

  const toggleExercise = (exercise: Exercise) => {
    setSelectedExercises((prev) => {
      const isAlreadySelected = prev.some((e) => e.id === exercise.id);
      if (isAlreadySelected) {
        return prev.filter((e) => e.id !== exercise.id);
      }
      return [...prev, exercise];
    });
  };

  const handleSubmit = () => {
    if (isReplaceMode) {
      if (!selectedExercise) return;
      const formData = new FormData();
      formData.append("intent", "replace-exercise");
      formData.append("oldExerciseId", replaceExerciseId);
      formData.append("newExerciseId", selectedExercise.id);
      fetcher.submit(formData, { method: "post" });
    } else {
      if (selectedExercises.length === 0) return;
      const formData = new FormData();
      formData.append("intent", "add-exercises");
      for (const exercise of selectedExercises) {
        formData.append("exerciseIds", exercise.id);
      }
      fetcher.submit(formData, { method: "post" });
    }

    resetAndClose();
  };

  const resetAndClose = () => {
    setSelectedExercise(null);
    setSelectedExercises([]);
    setSearchQuery("");
    setSelectedType("all");
    onOpenChange(false);
  };

  const canSubmit = isReplaceMode
    ? !!selectedExercise
    : selectedExercises.length > 0;

  const addButtonLabel = () => {
    if (fetcher.state === "submitting") {
      return isReplaceMode ? "Replacing..." : "Adding...";
    }
    if (isReplaceMode) return "Replace";
    if (selectedExercises.length === 0) return "Add";
    return `Add (${selectedExercises.length})`;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 480, maxHeight: "80vh" }}>
        <Dialog.Title size="4">
          {isReplaceMode ? "Replace Exercise" : "Add Exercises"}
        </Dialog.Title>

        <Flex direction="column" gap="4" mt="4">
          <Flex gap="2">
            <TextField.Root
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flexGrow: 1 }}
              size="2"
            >
              <TextField.Slot>
                <MagnifyingGlassIcon height="14" width="14" />
              </TextField.Slot>
            </TextField.Root>

            <Select.Root
              value={selectedType}
              onValueChange={(value) =>
                setSelectedType(value as ExerciseType | "all")
              }
            >
              <Select.Trigger style={{ minWidth: 120 }} />
              <Select.Content>
                <Select.Item value="all">All</Select.Item>
                <Select.Item value="barbell">Barbell</Select.Item>
                <Select.Item value="dumbbell">Dumbbell</Select.Item>
                <Select.Item value="bodyweight">Bodyweight</Select.Item>
                <Select.Item value="machine">Machine</Select.Item>
                <Select.Item value="cable">Cable</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          <Text size="1" color="gray">
            {filteredExercises.length} exercise
            {filteredExercises.length !== 1 ? "s" : ""}
          </Text>

          <ScrollArea style={{ height: 300 }}>
            <Box>
              {filteredExercises.length === 0 ? (
                <Text size="2" color="gray" style={{ padding: "2rem 0" }}>
                  No exercises found.
                </Text>
              ) : (
                filteredExercises.map((exercise, index) => {
                  const isSelected = isReplaceMode
                    ? selectedExercise?.id === exercise.id
                    : selectedExercises.some((e) => e.id === exercise.id);
                  return (
                    <Box
                      key={exercise.id}
                      py="3"
                      px="2"
                      onClick={() => {
                        if (isReplaceMode) {
                          setSelectedExercise(exercise);
                        } else {
                          toggleExercise(exercise);
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        borderTop:
                          index === 0 ? undefined : "1px solid var(--gray-3)",
                        backgroundColor: isSelected
                          ? "var(--accent-3)"
                          : undefined,
                        borderRadius: isSelected ? 4 : undefined,
                      }}
                    >
                      <Flex justify="between" align="center">
                        <div>
                          <Text
                            size="2"
                            weight={isSelected ? "medium" : undefined}
                          >
                            {exercise.name}
                          </Text>
                          <Text
                            size="1"
                            color="gray"
                            style={{ display: "block", marginTop: 2 }}
                          >
                            {exercise.type}
                          </Text>
                        </div>
                        {!isReplaceMode && isSelected && (
                          <Badge size="1" variant="solid" radius="full">
                            <CheckIcon width="12" height="12" />
                          </Badge>
                        )}
                      </Flex>
                    </Box>
                  );
                })
              )}
            </Box>
          </ScrollArea>

          <Flex gap="3" justify="end">
            <Button
              variant="soft"
              size="2"
              onClick={resetAndClose}
              disabled={fetcher.state !== "idle"}
            >
              Cancel
            </Button>
            <Button
              size="2"
              onClick={handleSubmit}
              disabled={!canSubmit || fetcher.state !== "idle"}
            >
              {addButtonLabel()}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
