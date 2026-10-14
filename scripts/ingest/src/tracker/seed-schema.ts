import { readFile } from "node:fs/promises";
import { z } from "zod";

const seedCardSchema = z.object({
  key: z.string(),
  name: z.string(),
  set: z.string(),
  number: z.string(),
  year: z.string().nullable(),
  rarity: z.string(),
  variant: z.string(),
  special: z.boolean(),
  variantToConfirm: z.boolean(),
  refPriceUsd: z.number().nullable(),
  image: z.string().nullable(),
  pocket: z.string(),
});

const seedGoalSchema = z.object({
  id: z.string(),
  name: z.string(),
  format: z.object({ rows: z.number().int().positive(), cols: z.number().int().positive() }),
  sheets: z.number().int().positive(),
  cards: z.array(seedCardSchema),
});

const seedFileSchema = z.object({
  version: z.number(),
  generated: z.string(),
  description: z.string(),
  goals: z.array(seedGoalSchema),
});

export type SeedCard = z.infer<typeof seedCardSchema>;
export type SeedGoal = z.infer<typeof seedGoalSchema>;
export type SeedFile = z.infer<typeof seedFileSchema>;

export async function loadSeedTracker(path: string): Promise<SeedFile> {
  const raw = JSON.parse(await readFile(path, "utf-8"));
  return seedFileSchema.parse(raw);
}
