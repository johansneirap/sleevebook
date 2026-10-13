import { z } from "zod";
import { parsePocketCode } from "./pocket-code";

const pocketCodeString = z.string().refine(
  (value) => {
    try {
      parsePocketCode(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Must be a pocket code like "S3·B·5"' },
);

const formatSchema = z.object({
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
});

const themeSchema = z.object({
  preset: z.string(),
  sleeve: z.string(),
  bg: z.string().optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  startsOnNewSide: z.boolean().optional(),
});

const panelSchema = z.object({
  id: z.string(),
  asset: z.string(),
  anchor: pocketCodeString,
  span: z.object({
    rows: z.number().int().positive(),
    cols: z.number().int().positive(),
  }),
  crop: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().positive(),
  }),
  seamMm: z.number().min(0),
});

const pocketContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("card"),
    variant: z.string(),
    instance: z.string().nullable(),
    locked: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("placeholder"),
    variant: z.string(),
    style: z.enum(["ficha", "silueta", "minimal", "vacio-con-borde"]),
    locked: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("empty"),
    locked: z.boolean().optional(),
  }),
]);

export const layoutSchema = z.object({
  format: formatSchema,
  opening: z.enum(["side", "top"]),
  sheets: z.number().int().positive(),
  theme: themeSchema,
  sections: z.array(sectionSchema).default([]),
  panels: z.array(panelSchema).default([]),
  pockets: z.record(pocketCodeString, pocketContentSchema).default({}),
});

export type Layout = z.infer<typeof layoutSchema>;
