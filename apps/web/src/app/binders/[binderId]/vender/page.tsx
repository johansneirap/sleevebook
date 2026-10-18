import {
  convertMoney,
  type Layout,
  parsePocketCode,
  resolvePocketPrice,
} from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { priceToInput } from "../../../../components/seller/listing-model";
import { type ListingRowData, ListingsEditor } from "../../../../components/seller/listings-editor";
import { SellerSettingsForm } from "../../../../components/seller/seller-settings-form";
import "../../../../components/seller/seller.css";
import "../../../../components/library/catalog.css";
import { getBinderWithLayout, getVariantDisplays } from "../../../../lib/binders";
import { getListings } from "../../../../lib/listings";
import { getExchangeRates } from "../../../../lib/money";
import { getLatestPrices } from "../../../../lib/pricing";
import { requireBinderOwner } from "../../../../lib/session";

interface PageProps {
  params: Promise<{ binderId: string }>;
}

type CardPocket = Extract<Layout["pockets"][string], { kind: "card" }>;

function sideRank(side: string): number {
  return side === "F" ? 0 : 1;
}

export default async function SellerModePage({ params }: PageProps) {
  const { binderId } = await params;
  await requireBinderOwner(binderId, `/binders/${binderId}/vender`);

  const data = await getBinderWithLayout(binderId);
  if (!data) {
    notFound();
  }

  // Card pockets only, in reading order: sheet, then front before back, then index.
  const cardPockets: Array<[string, CardPocket]> = Object.entries(data.layout.pockets)
    .filter((entry): entry is [string, CardPocket] => entry[1].kind === "card")
    .sort(([a], [b]) => {
      const pa = parsePocketCode(a);
      const pb = parsePocketCode(b);
      return pa.sheet - pb.sheet || sideRank(pa.side) - sideRank(pb.side) || pa.index - pb.index;
    });

  const variantIds = [...new Set(cardPockets.map(([, content]) => content.variant))];
  const [displays, prices, exchange, listings] = await Promise.all([
    getVariantDisplays(variantIds),
    getLatestPrices(variantIds),
    getExchangeRates(),
    getListings(binderId),
  ]);

  const currency = data.currency;
  const rows: ListingRowData[] = cardPockets.map(([code, content]) => {
    const display = displays.get(content.variant);
    const parsed = parsePocketCode(code);
    const listing = listings[code];

    const reference = resolvePocketPrice(
      content,
      undefined,
      prices[content.variant]?.amountUsd,
      currency,
      exchange.rates,
    );

    let savedPrice: number | null = null;
    if (listing?.price != null) {
      savedPrice =
        convertMoney(listing.price, listing.currency, currency, exchange.rates) ?? listing.price;
    }

    return {
      pocketCode: code,
      name: display?.name ?? "Carta sin datos",
      setName: display?.setName ?? "",
      number: display?.number ?? String(parsed.index),
      imageUrl: display?.imageUrl ?? null,
      reference:
        reference && reference.origin !== "vendedor"
          ? { amount: reference.amount, origin: reference.origin }
          : null,
      saved: {
        status: listing?.status ?? "disponible",
        price: priceToInput(savedPrice, currency),
      },
    };
  });

  return (
    <main className="sb-catalog-page sb-seller-page">
      <p style={{ margin: 0 }}>
        <Link href={`/binders/${binderId}`} className="sb-seller-back">
          &larr; Volver al binder
        </Link>
      </p>

      <header style={{ marginTop: 28 }}>
        <p className="sb-catalog-eyebrow">Modo vendedor</p>
        <h1 className="sb-catalog-title">Vender</h1>
        <p className="sb-seller-note" style={{ marginTop: 14 }}>
          {data.name} · {data.mode === "seller" ? "Modo Venta activo" : "Modo Colección activo"}
        </p>
      </header>

      <div className="sb-seller-section">
        <h2 className="sb-seller-section-title">Configuración</h2>
        <SellerSettingsForm
          binderId={binderId}
          mode={data.mode}
          currency={currency}
          contact={data.sellerContact}
        />
      </div>

      <div className="sb-seller-section">
        <ListingsEditor key={currency} binderId={binderId} currency={currency} rows={rows} />
      </div>
    </main>
  );
}
