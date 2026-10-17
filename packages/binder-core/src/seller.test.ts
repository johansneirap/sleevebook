import { describe, expect, it } from "vitest";
import { formatWantList, resolvePocketPrice, sellerContactSchema } from "./seller";

const card = { kind: "card" as const, variant: "a", instance: null };

describe("resolvePocketPrice", () => {
  it("prefers the seller's listing price, converted to the display currency", () => {
    const price = resolvePocketPrice(
      { ...card, priceOverrideUsd: 3 },
      { status: "disponible", price: 9500, currency: "clp" },
      2,
      "usd",
      { clp: 950 },
    );
    expect(price).toEqual({ amount: 10, currency: "usd", origin: "vendedor" });
  });

  it("falls back to the manual override, then to the market price", () => {
    expect(
      resolvePocketPrice({ ...card, priceOverrideUsd: 3 }, undefined, 2, "usd", {})?.origin,
    ).toBe("manual");
    expect(resolvePocketPrice(card, undefined, 2, "clp", { clp: 900 })).toEqual({
      amount: 1800,
      currency: "clp",
      origin: "mercado",
    });
  });

  it("is undefined for non-cards, unpriced cards or a missing rate", () => {
    expect(resolvePocketPrice({ kind: "empty" }, undefined, 2, "usd", {})).toBeUndefined();
    expect(resolvePocketPrice(card, undefined, undefined, "usd", {})).toBeUndefined();
    expect(resolvePocketPrice(card, undefined, 2, "eur", {})).toBeUndefined();
  });
});

describe("sellerContactSchema", () => {
  it("accepts wa.me digits, an instagram handle and an email", () => {
    expect(
      sellerContactSchema.safeParse({
        whatsapp: "56912345678",
        instagram: "riolu.cards",
        email: "a@b.cl",
      }).success,
    ).toBe(true);
    expect(sellerContactSchema.safeParse({ whatsapp: "+56 9 1234" }).success).toBe(false);
  });
});

describe("formatWantList", () => {
  it("lists one card per line with pocket code and price", () => {
    const text = formatWantList(
      [
        {
          pocketCode: "S1·F·1",
          name: "Lucario",
          number: "6",
          setName: "Legends",
          price: { amount: 5, currency: "usd", origin: "vendedor" },
        },
      ],
      (p) => `$${p.amount}`,
    );
    expect(text).toBe("• Lucario #6 (Legends) [S1·F·1] — $5");
  });
});
