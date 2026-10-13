import { describe, expect, it } from "vitest";
import { type PocketState, reflow } from "./reflow.js";

function pocketsOfSheet1Front(): PocketState<string>[] {
  return Array.from({ length: 9 }, (_, i) => ({
    code: `S1·F·${i + 1}`,
    coveredByPanel: i + 1 >= 4 && i + 1 <= 6,
    content: String(i + 1),
  }));
}

describe("reflow", () => {
  it("inserting at the start shifts content forward, jumping over a panel without overwriting it", () => {
    const pockets = pocketsOfSheet1Front();
    const result = reflow(pockets, { type: "insert", at: "S1·F·1", content: "X" });

    expect(result.map((p) => p.content)).toEqual(["X", "1", "2", "4", "5", "6", "3", "7", "8"]);
  });

  it("removing shifts content back and clears the last movable slot", () => {
    const pockets = pocketsOfSheet1Front();
    const result = reflow(pockets, { type: "remove", at: "S1·F·1", emptyContent: "" });

    expect(result.map((p) => p.content)).toEqual(["2", "3", "7", "4", "5", "6", "8", "9", ""]);
  });

  it("never moves a locked pocket", () => {
    const pockets = pocketsOfSheet1Front();
    pockets[1] = { ...(pockets[1] as PocketState<string>), locked: true };
    const result = reflow(pockets, { type: "insert", at: "S1·F·1", content: "X" });

    expect(result[1]?.content).toBe("2");
  });

  it("returns the layout unchanged when the target pocket does not exist", () => {
    const pockets = pocketsOfSheet1Front();
    const result = reflow(pockets, { type: "insert", at: "S1·F·99", content: "X" });

    expect(result.map((p) => p.content)).toEqual(pockets.map((p) => p.content));
  });

  it("returns the layout unchanged when nothing after the target is movable", () => {
    const pockets: PocketState<string>[] = [
      { code: "S1·F·1", content: "1" },
      { code: "S1·F·2", locked: true, content: "2" },
    ];
    const result = reflow(pockets, { type: "insert", at: "S1·F·2", content: "X" });

    expect(result.map((p) => p.content)).toEqual(["1", "2"]);
  });
});
