import { describe, expect, it } from "vitest";
import { decideAlerts, type WatchedItem } from "./alerts";

function item(overrides: Partial<WatchedItem> = {}): WatchedItem {
  return {
    wishlistItemId: "w1",
    userId: "u1",
    variantId: "v1",
    targetUsd: 10,
    alertedAt: null,
    latestUsd: 12,
    cardName: "Lucario ex",
    setName: "Obsidian Flames",
    number: "130",
    ...overrides,
  };
}

describe("decideAlerts", () => {
  it("notifies when an armed item is at or below the target", () => {
    const decision = decideAlerts([item({ latestUsd: 9.5 })]);
    expect(decision.rearm).toEqual([]);
    expect(decision.alerts).toHaveLength(1);
    const [alert] = decision.alerts;
    expect(alert?.wishlistItemId).toBe("w1");
    expect(alert?.notification).toEqual({
      userId: "u1",
      kind: "precio",
      title: "Lucario ex bajó a US$9.50",
      body: "Obsidian Flames · #130 · tu objetivo: US$10.00",
      href: "/deseos",
      data: { variantId: "v1", price: 9.5, target: 10 },
    });
  });

  it("notifies when the price equals the target", () => {
    expect(decideAlerts([item({ latestUsd: 10 })]).alerts).toHaveLength(1);
  });

  it("does not notify while the price is above the target and stays armed", () => {
    const decision = decideAlerts([item({ latestUsd: 10.01 })]);
    expect(decision.alerts).toEqual([]);
    expect(decision.rearm).toEqual([]);
  });

  it("does not notify again while already fired and still below the target", () => {
    const decision = decideAlerts([item({ latestUsd: 8, alertedAt: new Date() })]);
    expect(decision.alerts).toEqual([]);
    expect(decision.rearm).toEqual([]);
  });

  it("re-arms a fired item when the price goes back above the target", () => {
    const decision = decideAlerts([item({ latestUsd: 15, alertedAt: new Date() })]);
    expect(decision.alerts).toEqual([]);
    expect(decision.rearm).toEqual(["w1"]);
  });

  it("does nothing for items without a current price", () => {
    const decision = decideAlerts([item({ latestUsd: null })]);
    expect(decision).toEqual({ alerts: [], rearm: [] });
  });

  it("handles a mixed batch independently per item", () => {
    const decision = decideAlerts([
      item({ wishlistItemId: "a", latestUsd: 5 }),
      item({ wishlistItemId: "b", latestUsd: 50 }),
      item({ wishlistItemId: "c", latestUsd: 5, alertedAt: new Date() }),
      item({ wishlistItemId: "d", latestUsd: 50, alertedAt: new Date() }),
    ]);
    expect(decision.alerts.map((alert) => alert.wishlistItemId)).toEqual(["a"]);
    expect(decision.rearm).toEqual(["d"]);
  });
});
