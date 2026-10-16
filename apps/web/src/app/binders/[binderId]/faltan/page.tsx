import { sumVariantPricesUsd } from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVariantDisplays } from "../../../../lib/binders";
import { getGoalProgress } from "../../../../lib/goals";
import { getLatestPrices } from "../../../../lib/pricing";
import "../../../../components/library/catalog.css";

interface PageProps {
  params: Promise<{ binderId: string }>;
}

export default async function MissingCardsPage({ params }: PageProps) {
  const { binderId } = await params;

  const progress = await getGoalProgress(binderId);
  if (!progress) {
    notFound();
  }

  const displays = await getVariantDisplays(progress.missingVariantIds);
  const prices = await getLatestPrices(progress.allVariantIds);
  const priceLookup = Object.fromEntries(
    Object.entries(prices).map(([id, price]) => [id, price.amountUsd]),
  );

  const missing = progress.missingVariantIds
    .map((id) => displays.get(id))
    .filter((display): display is NonNullable<typeof display> => display !== undefined)
    .sort((a, b) => {
      const priceDiff = (prices[b.id]?.amountUsd ?? 0) - (prices[a.id]?.amountUsd ?? 0);
      return priceDiff !== 0
        ? priceDiff
        : a.setName.localeCompare(b.setName) || a.name.localeCompare(b.name);
    });

  const objectiveValueUsd = sumVariantPricesUsd(progress.allVariantIds, priceLookup);
  const missingValueUsd = sumVariantPricesUsd(progress.missingVariantIds, priceLookup);

  return (
    <main className="sb-catalog-page">
      <p style={{ margin: 0 }}>
        <Link
          href={`/binders/${binderId}`}
          className="sb-catalog-eyebrow"
          style={{ textDecoration: "none" }}
        >
          &larr; Volver al binder
        </Link>
      </p>

      <header style={{ marginTop: 28 }}>
        <p className="sb-catalog-eyebrow">Checklist del objetivo</p>
        <h1 className="sb-catalog-title">Me faltan ({missing.length})</h1>
        {objectiveValueUsd > 0 && (
          <p className="sb-checklist-summary">
            <span className="sb-label">Valor del objetivo:</span>{" "}
            <span className="sb-data">${objectiveValueUsd.toFixed(2)} USD</span> —{" "}
            <span className="sb-label">Valor de lo que falta:</span>{" "}
            <span className="sb-data">${missingValueUsd.toFixed(2)} USD</span>
          </p>
        )}
        <p className="sb-catalog-eyebrow" style={{ marginTop: 14, letterSpacing: "0.12em" }}>
          Ordenada de mayor a menor precio.
        </p>
      </header>

      {missing.length === 0 ? (
        <p className="sb-catalog-empty">Tienes todas las cartas de este objetivo.</p>
      ) : (
        <div style={{ marginTop: 36 }}>
          <div className="sb-checklist-head" aria-hidden="true">
            <span style={{ gridArea: "set" }}>Set</span>
            <span style={{ gridArea: "name" }}>Carta</span>
            <span style={{ gridArea: "price", textAlign: "right" }}>Precio</span>
          </div>
          <ul className="sb-checklist" style={{ marginTop: 0 }}>
            {missing.map((item) => (
              <li key={item.id} className="sb-checklist-row">
                <span className="sb-checklist-set">{item.setName}</span>
                <span className="sb-checklist-name">
                  {item.name} <span className="sb-checklist-num">{item.number}</span> (
                  {item.variant})
                </span>
                {prices[item.id] && (
                  <span className="sb-checklist-price">{`$${prices[item.id]?.amountUsd.toFixed(2)} USD`}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
