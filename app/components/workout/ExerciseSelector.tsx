import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import {
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
}

export function ExerciseSelector({
  exercises,
  open,
  onOpenChange,
}: ExerciseSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ExerciseType | "all">("all");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );
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

  const handleSubmit = () => {
    if (!selectedExercise) return;

    const formData = new FormData();
    formData.append("intent", "add-exercise");
    formData.append("exerciseId", selectedExercise.id);

    fetcher.submit(formData, { method: "post" });

    setSelectedExercise(null);
    setSearchQuery("");
    setSelectedType("all");
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedExercise(null);
    setSearchQuery("");
    setSelectedType("all");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 480, maxHeight: "80vh" }}>
        <Dialog.Title size="4">Add Exercise</Dialog.Title>

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
                  const isSelected = selectedExercise?.id === exercise.id;
                  return (
                    <Box
                      key={exercise.id}
                      py="3"
                      px="2"
                      onClick={() => setSelectedExercise(exercise)}
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
                      <Text size="2" weight={isSelected ? "medium" : undefined}>
                        {exercise.name}
                      </Text>
                      <Text
                        size="1"
                        color="gray"
                        style={{ display: "block", marginTop: 2 }}
                      >
                        {exercise.type}
                      </Text>
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
              onClick={handleClose}
              disabled={fetcher.state !== "idle"}
            >
              Cancel
            </Button>
            <Button
              size="2"
              onClick={handleSubmit}
              disabled={!selectedExercise || fetcher.state !== "idle"}
            >
              {fetcher.state === "submitting" ? "Adding..." : "Add"}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
