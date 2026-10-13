import { describe, expect, it } from "vitest";
import { generateSpreads } from "./spread";

describe("spread", () => {
  it("generates sheets + 1 spreads for a 20-sheet binder", () => {
    const spreads = generateSpreads(20);
    expect(spreads).toHaveLength(21);
  });

  it("shows a single face on the first and last spread", () => {
    const spreads = generateSpreads(20);
    expect(spreads[0]?.faces).toEqual([{ sheet: 1, side: "F" }]);
    expect(spreads[20]?.faces).toEqual([{ sheet: 20, side: "B" }]);
  });

  it("shows the back of sheet n and the front of sheet n+1 in between", () => {
    const spreads = generateSpreads(20);
    expect(spreads[1]?.faces).toEqual([
      { sheet: 1, side: "B" },
      { sheet: 2, side: "F" },
    ]);
    expect(spreads[19]?.faces).toEqual([
      { sheet: 19, side: "B" },
      { sheet: 20, side: "F" },
    ]);
  });
});
