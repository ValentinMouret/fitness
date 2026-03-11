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
import "./ExerciseSelector.css";

interface ExerciseSelectorExercise {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

interface ExerciseSelectorProps {
  readonly exercises: ReadonlyArray<ExerciseSelectorExercise>;
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
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseSelectorExercise | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<
    ReadonlyArray<ExerciseSelectorExercise>
  >([]);
  const fetcher = useFetcher();

  const availableTypes = useMemo(() => {
    return Array.from(
      new Set(exercises.map((exercise) => exercise.type)),
    ).sort();
  }, [exercises]);

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

  const toggleExercise = (exercise: ExerciseSelectorExercise) => {
    setSelectedExercises((prev) => {
      const isAlreadySelected = prev.some((item) => item.id === exercise.id);
      if (isAlreadySelected) {
        return prev.filter((item) => item.id !== exercise.id);
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
      <Dialog.Content className="exercise-selector__dialog">
        <Dialog.Title size="4">
          {isReplaceMode ? "Replace Exercise" : "Add Exercises"}
        </Dialog.Title>

        <Flex direction="column" gap="4" mt="4">
          <Flex gap="2">
            <TextField.Root
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="exercise-selector__search"
              size="2"
            >
              <TextField.Slot>
                <MagnifyingGlassIcon height="14" width="14" />
              </TextField.Slot>
            </TextField.Root>

            <Select.Root value={selectedType} onValueChange={setSelectedType}>
              <Select.Trigger className="exercise-selector__type-trigger" />
              <Select.Content>
                <Select.Item value="all">All</Select.Item>
                {availableTypes.map((type) => (
                  <Select.Item key={type} value={type}>
                    {type}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>

          <Text size="1" color="gray">
            {filteredExercises.length} exercise
            {filteredExercises.length !== 1 ? "s" : ""}
          </Text>

          <ScrollArea className="exercise-selector__results">
            <Box>
              {filteredExercises.length === 0 ? (
                <Text
                  size="2"
                  color="gray"
                  className="exercise-selector__empty-state"
                >
                  No exercises found.
                </Text>
              ) : (
                filteredExercises.map((exercise, index) => {
                  const isSelected = isReplaceMode
                    ? selectedExercise?.id === exercise.id
                    : selectedExercises.some((item) => item.id === exercise.id);

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
                      className={`exercise-selector__item ${index > 0 ? "exercise-selector__item--separated" : ""} ${isSelected ? "exercise-selector__item--selected" : ""}`}
                    >
                      <Flex justify="between" align="center">
                        <div>
                          <Text
                            size="2"
                            weight={isSelected ? "medium" : undefined}
                          >
                            {exercise.name}
                          </Text>
                          <Text as="div" size="1" color="gray" mt="1">
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

          <Flex justify="end" gap="2">
            <Button variant="soft" color="gray" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {addButtonLabel()}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
