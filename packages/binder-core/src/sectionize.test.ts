import { describe, expect, it } from "vitest";
import { sectionize } from "./sectionize";

describe("sectionize", () => {
  it("groups consecutive items by key, preserving order", () => {
    const items = [
      { era: "BW", number: "1" },
      { era: "BW", number: "2" },
      { era: "SV", number: "1" },
      { era: "SV", number: "2" },
    ];
    const sections = sectionize(items, (i) => i.era);

    expect(sections.map((s) => s.key)).toEqual(["BW", "SV"]);
    expect(sections[0]?.items).toHaveLength(2);
    expect(sections[1]?.items).toHaveLength(2);
  });

  it("starts a new section when the key reappears non-consecutively", () => {
    const items = [{ era: "BW" }, { era: "SV" }, { era: "BW" }];
    const sections = sectionize(items, (i) => i.era);

    expect(sections.map((s) => s.key)).toEqual(["BW", "SV", "BW"]);
  });

  it("propagates the startOnNewSide option to every section", () => {
    const sections = sectionize([{ era: "BW" }], (i) => i.era, { startOnNewSide: true });
    expect(sections[0]?.startOnNewSide).toBe(true);
  });
});
