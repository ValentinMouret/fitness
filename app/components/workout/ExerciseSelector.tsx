import { useState, useMemo } from "react";
import {
  Dialog,
  TextField,
  Button,
  Flex,
  Text,
  Select,
  Card,
  Badge,
  TextArea,
  Box,
  ScrollArea,
} from "@radix-ui/themes";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
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
  const [notes, setNotes] = useState("");
  const fetcher = useFetcher();

  // Filter and search exercises
  const filteredExercises = useMemo(() => {
    let filtered = exercises;

    // Filter by type
    if (selectedType !== "all") {
      filtered = filtered.filter((exercise) => exercise.type === selectedType);
    }

    // Filter by search query (fuzzy search on name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((exercise) =>
        exercise.name.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [exercises, selectedType, searchQuery]);

  const handleSubmit = () => {
    if (!selectedExercise) return;

    const formData = new FormData();
    formData.append("intent", "add-exercise");
    formData.append("exerciseId", selectedExercise.id);
    formData.append("notes", notes);

    fetcher.submit(formData, { method: "post" });

    // Reset form and close
    setSelectedExercise(null);
    setNotes("");
    setSearchQuery("");
    setSelectedType("all");
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedExercise(null);
    setNotes("");
    setSearchQuery("");
    setSelectedType("all");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: "600px", maxHeight: "80vh" }}>
        <Dialog.Title>Add Exercise</Dialog.Title>

        <Flex direction="column" gap="4" mt="4">
          {/* Search and Filter */}
          <Flex gap="2">
            <TextField.Root
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flexGrow: 1 }}
            >
              <TextField.Slot>
                <MagnifyingGlassIcon height="16" width="16" />
              </TextField.Slot>
            </TextField.Root>

            <Select.Root
              value={selectedType}
              onValueChange={(value) =>
                setSelectedType(value as ExerciseType | "all")
              }
            >
              <Select.Trigger
                placeholder="Filter by type"
                style={{ minWidth: "150px" }}
              />
              <Select.Content>
                <Select.Item value="all">All Types</Select.Item>
                <Select.Item value="barbell">Barbell</Select.Item>
                <Select.Item value="dumbbell">Dumbbell</Select.Item>
                <Select.Item value="bodyweight">Bodyweight</Select.Item>
                <Select.Item value="machine">Machine</Select.Item>
                <Select.Item value="cable">Cable</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          {/* Results Count */}
          <Text size="2" color="gray">
            {filteredExercises.length} exercise
            {filteredExercises.length !== 1 ? "s" : ""} found
          </Text>

          {/* Exercise List */}
          <ScrollArea style={{ height: "300px" }}>
            <Flex direction="column" gap="2">
              {filteredExercises.length === 0 ? (
                <Text
                  size="3"
                  color="gray"
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  No exercises found. Try adjusting your search or filter.
                </Text>
              ) : (
                filteredExercises.map((exercise) => (
                  <Card
                    key={exercise.id}
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        selectedExercise?.id === exercise.id
                          ? "#e5f3ff"
                          : undefined,
                      border:
                        selectedExercise?.id === exercise.id
                          ? "2px solid #0066cc"
                          : undefined,
                    }}
                    onClick={() => setSelectedExercise(exercise)}
                  >
                    <Flex justify="between" align="center">
                      <Flex direction="column" gap="1">
                        <Text weight="bold">{exercise.name}</Text>
                        {exercise.description && (
                          <Text size="2" color="gray">
                            {exercise.description}
                          </Text>
                        )}
                      </Flex>
                      <Badge variant="soft">{exercise.type}</Badge>
                    </Flex>
                  </Card>
                ))
              )}
            </Flex>
          </ScrollArea>

          {/* Notes Input */}
          {selectedExercise && (
            <Box>
              <Text size="2" weight="bold" mb="2" as="div">
                Exercise Notes (Optional)
              </Text>
              <TextArea
                placeholder="Add notes for this exercise in your workout..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ width: "100%" }}
              />
            </Box>
          )}

          {/* Action Buttons */}
          <Flex gap="2" justify="end">
            <Button
              variant="soft"
              onClick={handleClose}
              disabled={fetcher.state !== "idle"}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedExercise || fetcher.state !== "idle"}
            >
              {fetcher.state === "submitting" ? "Adding..." : "Add Exercise"}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
