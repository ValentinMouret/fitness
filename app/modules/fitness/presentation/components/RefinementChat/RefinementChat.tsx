import { Button, Text, TextField } from "@radix-ui/themes";
import { useEffect, useId, useState } from "react";
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
  const savePrefFetcher = useFetcher<{
    readonly intent: string;
    readonly success?: boolean;
  }>();

  const labelId = useId();
  const [savedContents, setSavedContents] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [pendingContent, setPendingContent] = useState<string | null>(null);

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
    setPendingContent(content);
    savePrefFetcher.submit(
      {
        intent: "save-preference",
        content,
      },
      { method: "post" },
    );
  };

  useEffect(() => {
    if (savePrefFetcher.state === "idle" && pendingContent) {
      if (
        savePrefFetcher.data?.intent === "save-preference" &&
        savePrefFetcher.data?.success
      ) {
        setSavedContents((prev) => {
          const next = new Set(prev);
          next.add(pendingContent);
          return next;
        });
      }
      setPendingContent(null);
    }
  }, [savePrefFetcher.state, savePrefFetcher.data, pendingContent]);

  // Only show user messages in the chat (assistant responses are reflected in the workout preview)
  const visibleMessages = messages.filter(
    (_, i) => i > 0, // skip the initial "Generate my next workout" message
  );

  return (
    <div className="refinement-chat">
      <Text
        as="label"
        htmlFor={labelId}
        size="2"
        weight="medium"
        mb="2"
        style={{ display: "block" }}
      >
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
                  {(() => {
                    const isThisPending =
                      pendingContent === msg.content &&
                      savePrefFetcher.state !== "idle";
                    const isThisSaved = savedContents.has(msg.content);
                    return (
                      <Button
                        size="1"
                        variant="ghost"
                        onClick={() => handleSavePreference(msg.content)}
                        disabled={
                          isThisPending ||
                          isThisSaved ||
                          savePrefFetcher.state !== "idle"
                        }
                        color={isThisSaved ? "green" : undefined}
                      >
                        {isThisPending
                          ? "Saving..."
                          : isThisSaved
                            ? "Saved!"
                            : "Save as preference"}
                      </Button>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
          <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="refinement-chat__input-row">
        <TextField.Root
          id={labelId}
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
