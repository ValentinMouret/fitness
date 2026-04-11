import { Cross2Icon, PaperPlaneIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Dialog,
  Flex,
  IconButton,
  ScrollArea,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import type {
  ChatTurnResult,
  EstimationMessage,
  MealEstimationResult,
  ResolvedIngredient,
} from "~/modules/nutrition/domain/meal-estimation";
import type { MealCategory } from "~/modules/nutrition/domain/meal-template";
import { toDateString } from "~/time";
import { MessageBubble } from "./MessageBubble";
import "./QuickEstimateModal.css";

interface QuickEstimateModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentDate: Date;
}

type FetcherData =
  | ChatTurnResult
  | {
      readonly ingredients: readonly ResolvedIngredient[];
      readonly mealCategory: MealCategory;
    }
  | { readonly error: string };

export function QuickEstimateModal({
  isOpen,
  onClose,
  currentDate,
}: QuickEstimateModalProps) {
  const fetcher = useFetcher<FetcherData>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<EstimationMessage[]>([]);
  const [input, setInput] = useState("");
  const [estimate, setEstimate] = useState<MealEstimationResult | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastProcessedData = useRef<FetcherData | null>(null);

  const isLoading = fetcher.state !== "idle";

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!fetcher.data || fetcher.state !== "idle") return;
    if (fetcher.data === lastProcessedData.current) return;
    lastProcessedData.current = fetcher.data;

    const data = fetcher.data;

    if ("error" in data) {
      setError(data.error);
      setIsResolving(false);
      return;
    }

    if ("type" in data) {
      if (data.type === "message") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.content },
        ]);
      } else if (data.type === "estimate") {
        setEstimate(data.result);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: formatEstimateSummary(data.result),
          },
        ]);
      }
      return;
    }

    if ("ingredients" in data) {
      const dateStr = toDateString(currentDate);
      const returnTo = `/nutrition/meals?date=${dateStr}`;
      sessionStorage.setItem(
        "quickEstimate",
        JSON.stringify({
          ingredients: data.ingredients,
        }),
      );
      onClose();
      navigate(
        `/nutrition/meal-builder?meal=${data.mealCategory}&date=${dateStr}&returnTo=${encodeURIComponent(returnTo)}`,
      );
      setIsResolving(false);
    }
  }, [fetcher.data, fetcher.state, currentDate, navigate, onClose]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const newMessages: EstimationMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(newMessages);
    setInput("");
    setError(null);
    setEstimate(null);

    fetcher.submit(
      {
        intent: "chat",
        messages: JSON.stringify(newMessages),
      },
      { method: "post", action: "/api/nutrition/estimate-meal" },
    );
  }, [input, isLoading, messages, fetcher]);

  const handleAcceptEstimate = useCallback(() => {
    if (!estimate) return;
    setIsResolving(true);
    setError(null);

    fetcher.submit(
      {
        intent: "resolve",
        items: JSON.stringify(estimate.items),
        mealCategory: estimate.mealCategory,
      },
      { method: "post", action: "/api/nutrition/estimate-meal" },
    );
  }, [estimate, fetcher]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setMessages([]);
        setInput("");
        setEstimate(null);
        setError(null);
        setIsResolving(false);
        lastProcessedData.current = null;
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Content size="3" className="quick-estimate-modal">
        <Flex justify="between" align="center" mb="3" flexShrink="0">
          <Dialog.Title size="5">Quick Estimate</Dialog.Title>
          <Dialog.Close>
            <IconButton variant="ghost">
              <Cross2Icon />
            </IconButton>
          </Dialog.Close>
        </Flex>

        <Box flexGrow="1" className="quick-estimate-modal__scroll-inner">
          <ScrollArea className="quick-estimate-modal__scroll" ref={scrollRef}>
            <Flex direction="column" gap="3" p="1">
              {messages.length === 0 && (
                <Text size="2" color="gray" align="center" mt="6">
                  Describe what you ate and I'll estimate the calories and
                  macros.
                </Text>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={`${msg.role}-${i}`} message={msg} />
              ))}

              {isLoading && !isResolving && (
                <Flex align="center" gap="2" px="2">
                  <Spinner size="1" />
                  <Text size="2" color="gray">
                    Thinking...
                  </Text>
                </Flex>
              )}
            </Flex>
          </ScrollArea>
        </Box>

        {error && (
          <Text size="2" color="red" mt="2">
            {error}
          </Text>
        )}

        {estimate && (
          <Flex gap="2" mt="3" flexShrink="0">
            <Button
              onClick={handleAcceptEstimate}
              disabled={isLoading}
              className="quick-estimate-modal__accept-button"
            >
              {isResolving ? (
                <>
                  <Spinner size="1" /> Resolving ingredients...
                </>
              ) : (
                "Use this estimate"
              )}
            </Button>
          </Flex>
        )}

        {!estimate && (
          <Flex gap="2" mt="3" flexShrink="0">
            <Box flexGrow="1">
              <TextField.Root
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="I had a chicken caesar salad..."
                disabled={isLoading}
              />
            </Box>
            <IconButton
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <PaperPlaneIcon />
            </IconButton>
          </Flex>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}

function formatEstimateSummary(result: MealEstimationResult): string {
  const categoryLabel =
    result.mealCategory[0].toUpperCase() + result.mealCategory.slice(1);

  let totalCal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  const lines = result.items.map((item) => {
    const cal = Math.round((item.calories * item.estimatedGrams) / 100);
    const pro = Math.round((item.protein * item.estimatedGrams) / 100);
    const carb = Math.round((item.carbs * item.estimatedGrams) / 100);
    const fat = Math.round((item.fat * item.estimatedGrams) / 100);
    totalCal += cal;
    totalProtein += pro;
    totalCarbs += carb;
    totalFat += fat;
    return `• ${item.name} (${item.estimatedGrams}g) — ${cal} kcal`;
  });

  return `Here's my estimate (${categoryLabel}):\n\n${lines.join("\n")}\n\nTotal: ${totalCal} kcal | ${totalProtein}g protein | ${totalCarbs}g carbs | ${totalFat}g fat`;
}
