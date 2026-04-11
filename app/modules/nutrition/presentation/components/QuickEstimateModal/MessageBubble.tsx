import { Box, Flex, Text } from "@radix-ui/themes";
import type { EstimationMessage } from "~/modules/nutrition/domain/meal-estimation";

interface MessageBubbleProps {
  readonly message: EstimationMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <Flex justify={isUser ? "end" : "start"}>
      <Box
        px="3"
        py="2"
        className={`quick-estimate-modal__bubble ${isUser ? "quick-estimate-modal__bubble--user" : "quick-estimate-modal__bubble--assistant"}`}
      >
        <Text size="2">{message.content}</Text>
      </Box>
    </Flex>
  );
}
