import Anthropic from "@anthropic-ai/sdk";
import { env } from "~/env.server";

let anthropic: Anthropic | null = null;

export function getAiClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}
