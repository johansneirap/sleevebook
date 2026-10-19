import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../env";
import type { SCAN_ACCEPTED_TYPES } from "./scan-types";

/** Model for card reading. Exact id, no date suffix. */
export const SCAN_MODEL = "claude-haiku-5-5";

/** What Claude reads off the photo. Nullable (not optional) for structured outputs. */
export const ReadingSchema = z.object({
  isCard: z.boolean(),
  name: z.string(),
  setName: z.string().nullable(),
  number: z.string().nullable(),
  setTotal: z.string().nullable(),
  finish: z.enum(["holo", "reverse", "normal"]).nullable(),
  language: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type CardReading = z.infer<typeof ReadingSchema>;

export type ScanMediaType = (typeof SCAN_ACCEPTED_TYPES)[number];

const PROMPT = `You identify a Pokemon trading card from a photo for a collection app.

Read ONLY what is printed on the card:
- name: the Pokemon, Trainer or Energy name exactly as printed (keep suffixes such as "ex", "V", "VMAX", "LV.X", "Mega", "GX").
- number: the collector number as printed, without the total (for "112/198" use "112"). Keep letters such as "TG05" or "SWSH123".
- setTotal: the printed total after the slash (for "112/198" use "198"), or null.
- setName: the set name or set symbol name if legible, otherwise null.
- finish: "holo" if the card shows a holographic rare foil, "reverse" for reverse holo (foil everywhere except the artwork frame), "normal" for a plain card, or null if you cannot tell.
- language: the language of the printed text (e.g. "en", "es", "ja") or null.
- confidence: 0 to 1, how sure you are about name and number together.

Rules:
- If the photo is not a single Pokemon trading card (no card, several cards, a card back, a sleeve, a hand without a card), set isCard to false and leave the other fields empty (name "").
- Never guess a number or set total you cannot read. Use null.
- Do not describe the artwork or add anything that is not printed on the card.`;

interface VisionResult {
  stopReason: string | null;
  reading: CardReading | null;
  inputTokens: number;
  outputTokens: number;
}

let client: Anthropic | undefined;

function getClient(apiKey: string): Anthropic {
  client ??= new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  return client;
}

/**
 * One Claude Vision call that reads a card photo. Throws the SDK's errors
 * (RateLimitError, AuthenticationError, APIError, APIConnectionError) for the
 * caller to map. Never call this from tests: it hits the real API.
 */
export async function readCardImage(
  base64: string,
  mediaType: ScanMediaType,
): Promise<VisionResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }
  const response = await getClient(env.ANTHROPIC_API_KEY).messages.parse({
    model: SCAN_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(ReadingSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  return {
    stopReason: response.stop_reason,
    reading: response.parsed_output ?? null,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
