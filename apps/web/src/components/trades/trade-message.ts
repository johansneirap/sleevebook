import type { TradeCard } from "../../lib/trades";

function cardLine(card: TradeCard): string {
  const variant = card.variant && card.variant !== "normal" ? ` (${card.variant})` : "";
  return `- ${card.name}${variant} · ${card.setName} ${card.number}`;
}

/**
 * Prefilled message for WhatsApp / email: the cards each side can give.
 * Plain text, Spanish, no greeting by name (the viewer's name is not shared).
 */
export function buildTradeMessage({
  theyCanGive,
  youCanGive,
}: {
  theyCanGive: TradeCard[];
  youCanGive: TradeCard[];
}): string {
  const parts = ["Hola, vi en Sleevebook que tienes repetidas cartas que me faltan."];
  if (theyCanGive.length > 0) {
    parts.push("", "Me podrías dar:", ...theyCanGive.map(cardLine));
  }
  if (youCanGive.length > 0) {
    parts.push("", "Yo te puedo dar:", ...youCanGive.map(cardLine));
  }
  parts.push("", "¿Hacemos el intercambio?");
  return parts.join("\n");
}
