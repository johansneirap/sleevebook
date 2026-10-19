"use server";

import Anthropic from "@anthropic-ai/sdk";
import { SCAN_MATCH_THRESHOLD } from "@sleevebook/binder-core";
import { scanLog } from "@sleevebook/db";
import { env } from "../env";
import { db } from "./db";
import { countScansToday } from "./scan-limit";
import { findScanCandidates } from "./scan-match-db";
import {
  SCAN_ACCEPTED_TYPES,
  SCAN_MAX_BYTES,
  type ScanReading,
  type ScanResult,
  type ScanStatus,
} from "./scan-types";
import { type CardReading, readCardImage, type ScanMediaType } from "./scan-vision";
import { assertUser } from "./session";

const DEFAULT_DAILY_LIMIT = 30;
const DISABLED_MESSAGE = "El escaneo no está disponible por ahora.";
const BUSY_MESSAGE = "Mucha demanda, intenta en un momento";
const FAILED_MESSAGE = "No pudimos leer la carta. Intenta de nuevo.";

function isAcceptedType(type: string): type is ScanMediaType {
  return (SCAN_ACCEPTED_TYPES as readonly string[]).includes(type);
}

function toScanReading(reading: CardReading): ScanReading {
  return {
    name: reading.name,
    setName: reading.setName ?? undefined,
    number: reading.number ?? undefined,
    setTotal: reading.setTotal ?? undefined,
    finish: reading.finish ?? undefined,
  };
}

async function logScan(
  userId: string,
  status: ScanStatus,
  fields: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    reading?: CardReading | null;
    matchedVariantId?: string | null;
  } = {},
): Promise<void> {
  await db.insert(scanLog).values({
    userId,
    status,
    inputTokens: fields.inputTokens ?? null,
    outputTokens: fields.outputTokens ?? null,
    reading: fields.reading ?? null,
    matchedVariantId: fields.matchedVariantId ?? null,
  });
}

/** Maps an SDK failure to a result; logs server-side and counts the attempt. */
async function failScan(
  userId: string,
  error: unknown,
  remainingToday: number,
): Promise<ScanResult> {
  if (error instanceof Anthropic.AuthenticationError) {
    // Bad or revoked key: a configuration problem, not a user error. No scan was made.
    console.error("[scan] Anthropic rechazó la API key:", error.message);
    return { status: "disabled", candidates: [], message: DISABLED_MESSAGE };
  }
  let message = FAILED_MESSAGE;
  if (error instanceof Anthropic.RateLimitError) {
    message = BUSY_MESSAGE;
    console.error("[scan] rate limit de Anthropic");
  } else if (error instanceof Anthropic.APIConnectionError) {
    console.error("[scan] sin conexión con Anthropic:", error.message);
  } else if (error instanceof Anthropic.APIError) {
    console.error("[scan] error de Anthropic", error.status, error.message);
  } else {
    console.error("[scan] error inesperado:", error);
  }
  await logScan(userId, "error");
  return { status: "error", candidates: [], remainingToday, message };
}

/**
 * Identifies a card from a photo (Claude Vision) and matches it to the catalog.
 * The photo is never stored; only the reading and the matched variant are logged.
 */
export async function scanCard(formData: FormData): Promise<ScanResult> {
  const user = await assertUser();

  if (!env.ANTHROPIC_API_KEY) {
    return { status: "disabled", candidates: [], message: DISABLED_MESSAGE };
  }

  const image = formData.get("image");
  if (
    !(image instanceof File) ||
    !isAcceptedType(image.type) ||
    image.size === 0 ||
    image.size > SCAN_MAX_BYTES
  ) {
    return {
      status: "invalid",
      candidates: [],
      message: "Usa una foto JPG, PNG o WebP de hasta 1,5 MB.",
    };
  }

  const limit = env.SCAN_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT;
  const usedToday = await countScansToday(db, user.id);
  if (usedToday >= limit) {
    return {
      status: "limit",
      candidates: [],
      remainingToday: 0,
      message: "Llegaste al límite de escaneos de hoy.",
    };
  }
  const remainingToday = Math.max(0, limit - usedToday - 1);

  const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");

  let vision: Awaited<ReturnType<typeof readCardImage>>;
  try {
    vision = await readCardImage(base64, image.type);
  } catch (error) {
    return failScan(user.id, error, remainingToday);
  }

  const { reading, stopReason, inputTokens, outputTokens } = vision;
  const tokens = { inputTokens, outputTokens };

  if (stopReason === "refusal" || stopReason === "max_tokens" || !reading) {
    console.error("[scan] lectura sin resultado utilizable, stop_reason:", stopReason);
    await logScan(user.id, "error", tokens);
    return { status: "error", candidates: [], remainingToday, message: FAILED_MESSAGE };
  }

  if (!reading.isCard) {
    await logScan(user.id, "no-card", { ...tokens, reading });
    return {
      status: "no-card",
      candidates: [],
      remainingToday,
      message:
        "No vemos una carta Pokémon en la foto. Acércate y asegúrate de que se vea completa.",
    };
  }

  const candidates = await findScanCandidates(db, reading);
  const top = candidates[0];
  const matchedVariantId = top && top.score >= SCAN_MATCH_THRESHOLD ? top.variantId : null;
  await logScan(user.id, "ok", { ...tokens, reading, matchedVariantId });

  return {
    status: "ok",
    reading: toScanReading(reading),
    candidates,
    remainingToday,
  };
}
