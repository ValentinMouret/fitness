import { Button, Flex, Text } from "@radix-ui/themes";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <Flex justify="center" align="center" gap="3" py="4">
      <Button
        variant="outline"
        disabled={!hasPrevious}
        onClick={() => onPageChange(currentPage - 1)}
        size="2"
      >
        <ChevronLeft size={16} />
        Previous
      </Button>

      <Flex align="center" gap="2">
        <Text size="2" color="gray">
          Page {currentPage} of {totalPages}
        </Text>
      </Flex>

      <Button
        variant="outline"
        disabled={!hasNext}
        onClick={() => onPageChange(currentPage + 1)}
        size="2"
      >
        Next
        <ChevronRight size={16} />
      </Button>
    </Flex>
  );
}
