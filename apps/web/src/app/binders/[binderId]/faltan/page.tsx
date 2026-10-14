import { sumVariantPricesUsd } from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVariantDisplays } from "../../../../lib/binders";
import { getGoalProgress } from "../../../../lib/goals";
import { getLatestPrices } from "../../../../lib/pricing";

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
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>
        <Link href={`/binders/${binderId}`}>&larr; Volver al binder</Link>
      </p>
      <h1>Me faltan ({missing.length})</h1>
      {objectiveValueUsd > 0 && (
        <p>
          Valor del objetivo: ${objectiveValueUsd.toFixed(2)} USD — Valor de lo que falta: $
          {missingValueUsd.toFixed(2)} USD
        </p>
      )}
      <p style={{ color: "#888", fontSize: 13 }}>Ordenada de mayor a menor precio.</p>
      <ul>
        {missing.map((item) => (
          <li key={item.id}>
            {item.setName} — {item.name} {item.number} ({item.variant})
            {prices[item.id] && ` — $${prices[item.id]?.amountUsd.toFixed(2)} USD`}
          </li>
        ))}
      </ul>
    </main>
  );
}
