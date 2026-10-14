import type { Format } from "./format";
import { capacity } from "./format";
import type { Layout } from "./layout-schema";
import { layoutSchema } from "./layout-schema";
import { formatPocketCode, pocketCodeFromGlobalIndex } from "./pocket-code";

export function createEmptyLayout(
  format: Format,
  sheets: number,
  opening: "side" | "top" = "side",
): Layout {
  const pockets: Record<string, { kind: "empty" }> = {};
  const total = capacity(format, sheets);

  for (let i = 0; i < total; i++) {
    const code = formatPocketCode(pocketCodeFromGlobalIndex(i, format));
    pockets[code] = { kind: "empty" };
  }

  return layoutSchema.parse({
    format,
    opening,
    sheets,
    theme: { preset: "default", sleeve: "clear" },
    pockets,
  });
}
