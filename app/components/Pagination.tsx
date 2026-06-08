import { Button, Flex, Text, Tooltip } from "@radix-ui/themes";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

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
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      if (e.key === "ArrowLeft" && hasPrevious) {
        e.preventDefault();
        onPageChange(currentPage - 1);
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onPageChange(currentPage + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, hasPrevious, hasNext, onPageChange]);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination">
      <Flex justify="center" align="center" gap="3" py="4">
        <Tooltip content="Previous page (Left Arrow)">
          <Button
            variant="outline"
            disabled={!hasPrevious}
            onClick={() => onPageChange(currentPage - 1)}
            size="2"
            aria-label="Go to previous page (Left Arrow)"
            aria-keyshortcuts="ArrowLeft"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Previous
          </Button>
        </Tooltip>

        <Flex align="center" gap="2">
          <Text size="2" color="gray">
            Page {currentPage} of {totalPages}
          </Text>
        </Flex>

        <Tooltip content="Next page (Right Arrow)">
          <Button
            variant="outline"
            disabled={!hasNext}
            onClick={() => onPageChange(currentPage + 1)}
            size="2"
            aria-label="Go to next page (Right Arrow)"
            aria-keyshortcuts="ArrowRight"
          >
            Next
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </Tooltip>
      </Flex>
    </nav>
  );
}
