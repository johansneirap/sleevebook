import {
  type Currency,
  formatMoney,
  formatWantList,
  type ResolvedPrice,
} from "@sleevebook/binder-core";

export interface WantListItem {
  pocketCode: string;
  name: string;
  number?: string;
  setName?: string;
  price?: ResolvedPrice;
}

export function sumWantPrices(items: WantListItem[]): number {
  return items.reduce((total, item) => total + (item.price?.amount ?? 0), 0);
}

/** Plain-text list for "Copiar lista", WhatsApp and email. */
export function buildWantListText({
  binderName,
  url,
  items,
  currency,
}: {
  binderName: string;
  url: string;
  items: WantListItem[];
  currency: Currency;
}): string {
  const header = `Lista de cartas — ${binderName}\n${url}`;
  if (items.length === 0) {
    return header;
  }
  const lines = formatWantList(items, (price) => formatMoney(price.amount, price.currency));
  const priced = items.filter((item) => item.price).length;
  const parts = [header, "", lines];
  if (priced > 0) {
    const missing = items.length - priced;
    const suffix = missing > 0 ? ` (${missing} sin precio)` : "";
    parts.push("", `Total: ${formatMoney(sumWantPrices(items), currency)}${suffix}`);
  }
  return parts.join("\n");
}

export function whatsappUrl(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}

export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
