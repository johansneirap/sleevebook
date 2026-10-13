import { layoutSchema } from "@sleevebook/binder-core";

// base1-4.holo, etc. are not real card_variant ids yet (the editor that
// assigns those arrives in Fase 1) — this is only a static demo face.
export const sampleLayout = layoutSchema.parse({
  format: { rows: 3, cols: 3 },
  opening: "side",
  sheets: 1,
  theme: { preset: "default", sleeve: "clear" },
  pockets: {
    S1·F·1: { kind: "card", variant: "base1-4.holo", instance: null },
    S1·F·2: { kind: "card", variant: "base1-1.holo", instance: null },
    S1·F·3: { kind: "card", variant: "base1-2.normal", instance: null },
    S1·F·4: { kind: "card", variant: "base1-3.normal", instance: null },
    S1·F·5: { kind: "placeholder", variant: "base1-5.normal", style: "ficha" },
    S1·F·6: { kind: "card", variant: "base1-6.normal", instance: null },
    S1·F·7: { kind: "card", variant: "base1-7.normal", instance: null },
    S1·F·8: { kind: "card", variant: "base1-8.normal", instance: null },
    S1·F·9: { kind: "empty" },
  },
});

export const demoImageUrls: Record<string, string> = {
  "base1-4.holo": "https://images.pokemontcg.io/base1/4.png",
  "base1-1.holo": "https://images.pokemontcg.io/base1/1.png",
  "base1-2.normal": "https://images.pokemontcg.io/base1/2.png",
  "base1-3.normal": "https://images.pokemontcg.io/base1/3.png",
  "base1-6.normal": "https://images.pokemontcg.io/base1/6.png",
  "base1-7.normal": "https://images.pokemontcg.io/base1/7.png",
  "base1-8.normal": "https://images.pokemontcg.io/base1/8.png",
};
