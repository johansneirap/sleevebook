import {
  type Currency,
  convertFromUsd,
  currencySchema,
  formatMoney,
} from "@sleevebook/binder-core";
import { user } from "@sleevebook/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { formatRateDate } from "../../components/binder/binder-header";
import { SiteNav } from "../../components/site/site-nav";
import { WishlistRow, type WishlistRowData } from "../../components/wishlist/wishlist-row";
import { WishlistSearch } from "../../components/wishlist/wishlist-search";
import "../../components/library/catalog.css";
import "../../components/wishlist/wishlist.css";
import { db } from "../../lib/db";
import { getExchangeRates } from "../../lib/money";
import { requireUser } from "../../lib/session";
import { getWishlist, type WishlistEntry } from "../../lib/wishlist";

interface PageProps {
  searchParams: Promise<{ orden?: string }>;
}

const SORT_OPTIONS = [
  { value: "reciente", label: "Recientes" },
  { value: "precio", label: "Precio" },
] as const;

function sortEntries(entries: WishlistEntry[], sort: string): WishlistEntry[] {
  if (sort !== "precio") {
    return entries; // already newest first
  }
  // Most valuable first; cards without a market price go last.
  return [...entries].sort((a, b) => {
    if (a.priceUsd === null && b.priceUsd === null) return 0;
    if (a.priceUsd === null) return 1;
    if (b.priceUsd === null) return -1;
    return b.priceUsd - a.priceUsd;
  });
}

export default async function WishlistPage({ searchParams }: PageProps) {
  const viewer = await requireUser("/deseos");
  const { orden } = await searchParams;
  const sort = orden === "precio" ? "precio" : "reciente";

  const [entries, [profile], { rates, capturedAt }] = await Promise.all([
    getWishlist(viewer.id),
    db
      .select({ preferredCurrency: user.preferredCurrency })
      .from(user)
      .where(eq(user.id, viewer.id)),
    getExchangeRates(),
  ]);
  const parsedCurrency = currencySchema.safeParse(profile?.preferredCurrency);
  const currency: Currency = parsedCurrency.success ? parsedCurrency.data : "usd";

  // Converts a USD amount to the viewer's currency; USD when no rate exists yet.
  const displayMoney = (amountUsd: number): { text: string; usdFallback: boolean } => {
    const converted = convertFromUsd(amountUsd, currency, rates);
    if (converted === undefined) {
      return { text: formatMoney(amountUsd, "usd"), usdFallback: true };
    }
    return { text: formatMoney(converted, currency), usdFallback: false };
  };

  const pricedTotalUsd = entries.reduce((sum, entry) => sum + (entry.priceUsd ?? 0), 0);
  const unpricedCount = entries.filter((entry) => entry.priceUsd === null).length;
  const total = displayMoney(pricedTotalUsd);
  const rateNote = total.usdFallback
    ? "sin tipo de cambio"
    : currency !== "usd" && capturedAt
      ? `tipo de cambio al ${formatRateDate(capturedAt)}`
      : null;

  const rows: WishlistRowData[] = sortEntries(entries, sort).map((entry) => ({
    variantId: entry.variantId,
    name: entry.display.name,
    number: entry.display.number,
    variant: entry.display.variant,
    setName: entry.display.setName,
    imageUrl: entry.display.imageUrl,
    priceLabel: entry.priceUsd === null ? null : displayMoney(entry.priceUsd).text,
    cardmarketEur: entry.priceEur,
    targetPriceUsd: entry.targetPriceUsd,
    note: entry.note,
  }));

  return (
    <main className="sb-catalog-page">
      <SiteNav current="/deseos" />

      <header className="sb-wish-header">
        <div>
          <p className="sb-wish-eyebrow">
            Lista de deseos · {entries.length} {entries.length === 1 ? "carta" : "cartas"}
          </p>
          <h1 className="sb-wish-title">Mis deseos</h1>
        </div>
        {entries.length > 0 && (
          <div className="sb-wish-value">
            <span className="sb-wish-value-label">Valor de mercado</span>
            <span className="sb-wish-value-amount sb-data">{total.text}</span>
            {(rateNote || unpricedCount > 0) && (
              <span className="sb-wish-value-note sb-data">
                {[rateNote, unpricedCount > 0 ? `${unpricedCount} sin precio` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </div>
        )}
      </header>

      <div style={{ marginTop: 20 }}>
        <WishlistSearch listedIds={entries.map((entry) => entry.variantId)} />
      </div>

      {entries.length === 0 ? (
        <section className="sb-wish-empty" style={{ marginTop: 20 }}>
          <strong>Tu lista está vacía.</strong>
          <p>
            Busca cartas arriba, o abre «Me faltan» en un binder y agrega todo lo que te falta de
            una vez.
          </p>
          <p>
            <Link href="/binders">Ir a mis binders</Link>
          </p>
        </section>
      ) : (
        <section aria-label="Cartas en mis deseos" className="sb-wish-section">
          <div className="sb-wish-toolbar">
            <nav aria-label="Ordenar lista" className="sb-wish-sort">
              <span className="sb-wish-sort-label">Ordenar:</span>
              <span className="sb-wish-sort-track">
                {SORT_OPTIONS.map((option) => {
                  const active = option.value === sort;
                  return (
                    <Link
                      key={option.value}
                      href={`/deseos?orden=${option.value}`}
                      aria-current={active ? "page" : undefined}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </span>
            </nav>
            <p className="sb-wish-hint">
              Los avisos de precio usan el precio de mercado en USD: te avisamos cuando la carta
              baje de ese valor.
            </p>
          </div>

          <ul className="sb-wish-list" style={{ marginTop: 16 }}>
            {rows.map((row) => (
              <WishlistRow key={row.variantId} entry={row} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
