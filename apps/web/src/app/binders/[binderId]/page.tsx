import { computeBinderValueUsd, convertFromUsd, generateSpreads } from "@sleevebook/binder-core";
import { notFound } from "next/navigation";
import {
  BinderTitle,
  formatRateDate,
  ProgressFigure,
  ValueFigure,
} from "../../../components/binder/binder-header";
import { BinderStage } from "../../../components/binder/binder-stage";
import { OwnerToolbar } from "../../../components/binder/owner-toolbar";
import { ThemedMain } from "../../../components/binder/themed-main";
import { collectVariantIds, getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getGoalProgress } from "../../../lib/goals";
import { getExchangeRates } from "../../../lib/money";
import { getLatestPrices } from "../../../lib/pricing";
import { getShareLinkForBinder, getSiteUrl } from "../../../lib/share";
import { clampSpreadIndex } from "../../../lib/spreads";

interface PageProps {
  params: Promise<{ binderId: string }>;
  searchParams: Promise<{ spread?: string }>;
}

export default async function BinderViewerPage({ params, searchParams }: PageProps) {
  const { binderId } = await params;
  const { spread: spreadParam } = await searchParams;

  const binderData = await getBinderWithLayout(binderId);
  if (!binderData) {
    notFound();
  }

  const spreads = generateSpreads(binderData.sheets);
  const index = clampSpreadIndex(spreadParam, spreads.length - 1);
  if (!spreads[index]) {
    notFound();
  }

  const { format, pockets } = binderData.layout;

  const displays = await getVariantDisplays(collectVariantIds(pockets));
  const progress = await getGoalProgress(binderId);

  const allVariantIds = new Set<string>();
  for (const content of Object.values(pockets)) {
    if (content.kind === "card") {
      allVariantIds.add(content.variant);
    }
  }
  const prices = await getLatestPrices([...allVariantIds]);
  const priceLookup = Object.fromEntries(
    Object.entries(prices).map(([id, price]) => [id, price.amountUsd]),
  );
  const totalValueUsd = computeBinderValueUsd(pockets, priceLookup);

  const { rates, capturedAt } = await getExchangeRates();
  const displayCurrency = binderData.currency;
  const convertedValue = convertFromUsd(totalValueUsd, displayCurrency, rates);
  // Without a rate we quietly fall back to USD instead of hiding the value.
  const valueFigure =
    convertedValue === undefined
      ? { amount: totalValueUsd, currency: "usd" as const, note: "sin tipo de cambio" }
      : {
          amount: convertedValue,
          currency: displayCurrency,
          note:
            displayCurrency === "usd" || !capturedAt
              ? undefined
              : `tipo de cambio al ${formatRateDate(capturedAt)}`,
        };

  const shareInfo = await getShareLinkForBinder(binderId);
  const siteUrl = getSiteUrl();
  const isPublished = binderData.status === "published";

  return (
    <ThemedMain theme={binderData.layout.theme}>
      <OwnerToolbar
        binderId={binderId}
        isPublished={isPublished}
        shareInfo={isPublished ? shareInfo : null}
        siteUrl={siteUrl}
        missingHref={
          progress && progress.missingVariantIds.length > 0
            ? `/binders/${binderId}/faltan`
            : undefined
        }
      />

      <header style={{ display: "flex", flexDirection: "column", gap: 22, marginBottom: 40 }}>
        <BinderTitle>{binderData.name}</BinderTitle>
        {(totalValueUsd > 0 || progress) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              gap: "16px 48px",
            }}
          >
            {progress && (
              <ProgressFigure
                owned={progress.owned}
                total={progress.total}
                percentage={progress.percentage}
              />
            )}
            {totalValueUsd > 0 && <ValueFigure {...valueFigure} />}
          </div>
        )}
      </header>

      <BinderStage
        name={binderData.name}
        theme={binderData.layout.theme}
        startClosed={spreadParam === undefined}
        basePath={`/binders/${binderId}`}
        initialIndex={index}
        sheets={binderData.sheets}
        opening={binderData.layout.opening}
        format={format}
        pockets={pockets}
        panels={binderData.layout.panels}
        displays={displays}
        sleeve={binderData.layout.theme.sleeve}
      />
    </ThemedMain>
  );
}
