import { describe, expect, it } from "vitest";
import {
  buildIdentityPrompt,
  validateHabitSuggestions,
} from "./identity-placeholder.service.server";

describe("validateHabitSuggestions", () => {
  it("accepts identity phrases and Three Two-Minute-Rule versions", () => {
    const result = validateHabitSuggestions({
      identityPhrases: [
        "I am someone who brings calm attention to each day.",
        "I am someone who makes space to be fully present.",
        "I am someone who responds with patience when life feels full.",
      ],
      minimumVersions: [
        "Take three slow breaths.",
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    expect(result._unsafeUnwrap().identityPhrases).toHaveLength(3);
  });

  it("rejects a response that is not an identity phrase", () => {
    const result = validateHabitSuggestions({
      identityPhrases: [
        "Meditate every day.",
        "I am someone who makes room to be present.",
        "I am someone who returns to my breath.",
      ],
      minimumVersions: [
        "Take three slow breaths.",
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    expect(result.isErr()).toBe(true);
  });

  it("rejects phrases that cannot continue the shared typed prefix", () => {
    const result = validateHabitSuggestions({
      identityPhrases: [
        "I am the kind of person who meditates each day.",
        "I am someone who makes room to be present.",
        "I am someone who returns to my breath.",
      ],
      minimumVersions: [
        "Take three slow breaths.",
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    expect(result.isErr()).toBe(true);
  });

  it("rejects an extreme practice", () => {
    const result = validateHabitSuggestions({
      identityPhrases: [
        "I am someone who sits in stillness all day.",
        "I am someone who makes room to be present.",
        "I am someone who returns to my breath.",
      ],
      minimumVersions: [
        "Take three slow breaths.",
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    expect(result.isErr()).toBe(true);
  });

  it("rejects an extreme minimum version", () => {
    const result = validateHabitSuggestions({
      identityPhrases: [
        "I am someone who makes room to be present.",
        "I am someone who returns to my breath.",
        "I am someone who responds with patience.",
      ],
      minimumVersions: [
        "Meditate for hours.",
        "Sit down and notice one breath.",
        "Set a one-minute timer and breathe.",
      ],
    });

    expect(result.isErr()).toBe(true);
  });
});

describe("buildIdentityPrompt", () => {
  it("includes other habits as reference material", () => {
    expect(
      buildIdentityPrompt("Meditate", [
        {
          habitName: "Morning walk",
          identityPhrase: "I am someone who makes space to be present.",
        },
      ]),
    ).toContain(
      '"identityPhrase":"I am someone who makes space to be present."',
    );
  });

  it("does not invent context when there are no identity phrases", () => {
    expect(buildIdentityPrompt("Meditate", [])).toContain(
      "There are no existing identity phrases.",
    );
  });
});
