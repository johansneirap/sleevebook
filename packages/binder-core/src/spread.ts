import type { Side } from "./pocket-code";

export interface SheetFace {
  sheet: number;
  side: Side;
}

export interface Spread {
  index: number;
  faces: SheetFace[];
}

export function generateSpreads(sheets: number): Spread[] {
  const spreads: Spread[] = [{ index: 0, faces: [{ sheet: 1, side: "F" }] }];

  for (let sheet = 1; sheet < sheets; sheet++) {
    spreads.push({
      index: sheet,
      faces: [
        { sheet, side: "B" },
        { sheet: sheet + 1, side: "F" },
      ],
    });
  }

  spreads.push({ index: sheets, faces: [{ sheet: sheets, side: "B" }] });

  return spreads;
}
