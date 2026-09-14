import { useEffect, useRef, useState } from "react";
import "./AnimatedSuggestion.css";

interface AnimatedSuggestionProps {
  readonly suggestions: ReadonlyArray<string>;
  readonly prefix?: string;
  readonly ariaLabel: (suggestion: string) => string;
  readonly onAccept: (suggestion: string) => void;
  readonly onActiveSuggestionChange: (suggestion: string | undefined) => void;
}

export function AnimatedSuggestion({
  suggestions,
  prefix = "",
  ariaLabel,
  onAccept,
  onActiveSuggestionChange,
}: AnimatedSuggestionProps) {
  const suggestionFingerprint = suggestions.join("\u0000");
  const stableSuggestionsRef = useRef({
    fingerprint: suggestionFingerprint,
    values: suggestions,
  });
  if (stableSuggestionsRef.current.fingerprint !== suggestionFingerprint) {
    stableSuggestionsRef.current = {
      fingerprint: suggestionFingerprint,
      values: suggestions,
    };
  }
  const stableSuggestions = stableSuggestionsRef.current.values;
  const [text, setText] = useState(prefix);
  const [activeSuggestion, setActiveSuggestion] = useState<string>();

  useEffect(() => {
    const firstSuggestion = stableSuggestions[0];
    if (!firstSuggestion) return;

    let isCancelled = false;
    const setActive = (suggestion: string | undefined) => {
      setActiveSuggestion(suggestion);
      onActiveSuggestionChange(suggestion);
    };
    const pause = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, milliseconds);
      });

    const animate = async () => {
      let suggestionIndex = 0;

      while (!isCancelled) {
        const suggestion = stableSuggestions[suggestionIndex];
        if (!suggestion) return;
        setActive(suggestion);

        for (
          let characterIndex = prefix.length === 0 ? 1 : prefix.length + 1;
          characterIndex <= suggestion.length;
          characterIndex++
        ) {
          if (isCancelled) return;
          setText(suggestion.slice(0, characterIndex));
          await pause(38);
        }

        await pause(1000);

        for (
          let characterIndex = suggestion.length - 1;
          characterIndex >= prefix.length;
          characterIndex--
        ) {
          if (isCancelled) return;
          setText(suggestion.slice(0, characterIndex));
          await pause(21);
        }

        await pause(170);
        suggestionIndex = (suggestionIndex + 1) % stableSuggestions.length;
      }
    };

    void animate();
    return () => {
      isCancelled = true;
      setActive(undefined);
    };
  }, [onActiveSuggestionChange, prefix, stableSuggestions]);

  if (!activeSuggestion) return null;

  return (
    <button
      type="button"
      onClick={() => onAccept(activeSuggestion)}
      aria-label={ariaLabel(activeSuggestion)}
      className="animated-suggestion"
    >
      <span className="animated-suggestion__phrase">{text}</span>
      <span className="animated-suggestion__hint">Tap to use</span>
    </button>
  );
}
