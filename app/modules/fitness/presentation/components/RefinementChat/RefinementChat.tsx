import { Button, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { useFetcher } from "react-router";
import type { ConversationMessage } from "~/modules/fitness/domain/ai-generation";
import "./RefinementChat.css";

interface RefinementChatProps {
  readonly conversationId: string;
  readonly messages: ReadonlyArray<ConversationMessage>;
  readonly isLoading: boolean;
}

export function RefinementChat({
  conversationId,
  messages,
  isLoading,
}: RefinementChatProps) {
  const [input, setInput] = useState("");
  const refineFetcher = useFetcher();
  const savePrefFetcher = useFetcher();

  const isRefining = refineFetcher.state !== "idle";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRefining) return;

    refineFetcher.submit(
      {
        intent: "refine",
        conversationId,
        feedback: input.trim(),
      },
      { method: "post" },
    );
    setInput("");
  };

  const handleSavePreference = (content: string) => {
    savePrefFetcher.submit(
      {
        intent: "save-preference",
        content,
      },
      { method: "post" },
    );
  };

  // Only show user messages in the chat (assistant responses are reflected in the workout preview)
  const visibleMessages = messages.filter(
    (_, i) => i > 0, // skip the initial "Generate my next workout" message
  );

  return (
    <div className="refinement-chat">
      <Text size="2" weight="medium" mb="2" as="p">
        Refine your workout
      </Text>

      {visibleMessages.length > 0 && (
        <div className="refinement-chat__messages">
          {visibleMessages.map((msg) => (
            <div
              key={`${msg.role}-${msg.content.slice(0, 32)}`}
              className={`refinement-chat__message refinement-chat__message--${msg.role}`}
            >
              <Text size="2">{msg.content}</Text>
              {msg.role === "user" && (
                <div className="refinement-chat__save-pref">
                  <Button
                    size="1"
                    variant="ghost"
                    onClick={() => handleSavePreference(msg.content)}
                    disabled={savePrefFetcher.state !== "idle"}
                  >
                    Save as preference
                  </Button>
                </div>
              )}
            </div>
          ))}
          <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="refinement-chat__input-row">
        <TextField.Root
          className="refinement-chat__input"
          placeholder="e.g., swap bench for incline, add more back work..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isRefining || isLoading}
          size="2"
        />
        <Button
          type="submit"
          size="2"
          disabled={!input.trim() || isRefining || isLoading}
        >
          {isRefining ? "Refining..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
