import { describe, expect, it } from "vitest";
import { cardNameMentionsSpecies, decideSetAlerts, mergeSpecies } from "./set-alerts";

describe("cardNameMentionsSpecies", () => {
  it("matches whole words, case-insensitively, inside card names", () => {
    expect(cardNameMentionsSpecies("Lucario ex", "Lucario")).toBe(true);
    expect(cardNameMentionsSpecies("Mega Lucario", "Lucario")).toBe(true);
    expect(cardNameMentionsSpecies("LUCARIO V", "lucario")).toBe(true);
    expect(cardNameMentionsSpecies("Team Rocket's Pikachu", "Pikachu")).toBe(true);
  });

  it("does not match a longer word that only starts with the species", () => {
    expect(cardNameMentionsSpecies("Lucarion", "Lucario")).toBe(false);
    expect(cardNameMentionsSpecies("Pikachus", "Pikachu")).toBe(false);
  });

  it("handles species names with punctuation", () => {
    expect(cardNameMentionsSpecies("Mr. Mime", "Mr. Mime")).toBe(true);
    expect(cardNameMentionsSpecies("Farfetch'd", "Farfetch'd")).toBe(true);
    expect(cardNameMentionsSpecies("Ho-Oh ex", "Ho-Oh")).toBe(true);
  });

  it("ignores blank species", () => {
    expect(cardNameMentionsSpecies("Pikachu", "   ")).toBe(false);
  });
});

describe("mergeSpecies", () => {
  it("dedupes case-insensitively, keeps the first spelling and drops blanks", () => {
    expect(mergeSpecies(["Lucario", " "], ["lucario", "Pikachu"])).toEqual(["Lucario", "Pikachu"]);
  });
});

describe("decideSetAlerts", () => {
  const cards = ["Lucario ex", "Mega Lucario", "Lucarion", "Pikachu VMAX", "Bulbasaur"];

  it("notifies each user who follows a species present in the new set", () => {
    const result = decideSetAlerts("set-1", "Nuevo Set", cards, [
      { userId: "ana", species: ["Lucario"] },
      { userId: "bob", species: ["Pikachu", "Eevee"] },
      { userId: "cy", species: ["Eevee"] },
    ]);
    expect(result).toEqual([
      {
        userId: "ana",
        kind: "set-nuevo",
        title: "Nuevo set: Nuevo Set",
        body: "2 cartas de Lucario",
        href: "/avisos",
        data: { setId: "set-1", species: ["Lucario"], count: 2 },
      },
      {
        userId: "bob",
        kind: "set-nuevo",
        title: "Nuevo set: Nuevo Set",
        body: "1 carta de Pikachu",
        href: "/avisos",
        data: { setId: "set-1", species: ["Pikachu"], count: 1 },
      },
    ]);
  });

  it("lists every matched species and counts each card once", () => {
    const result = decideSetAlerts("set-2", "Otro", cards, [
      { userId: "ana", species: ["Lucario", "Pikachu", "Mewtwo"] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.body).toBe("3 cartas de Lucario, Pikachu");
    expect(result[0]?.data.count).toBe(3);
  });

  it("returns nothing when no followed species appears", () => {
    expect(
      decideSetAlerts("set-3", "Vacío", cards, [{ userId: "ana", species: ["Mewtwo"] }]),
    ).toEqual([]);
  });

  it("returns nothing when there are no follows", () => {
    expect(decideSetAlerts("set-4", "Vacío", cards, [])).toEqual([]);
  });
});
