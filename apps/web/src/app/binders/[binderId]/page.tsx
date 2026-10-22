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
import { pocketCopiesByCode } from "../../../components/binder/pocket-copy-badge";
import { ThemedMain } from "../../../components/binder/themed-main";
import { loadSellerPocketData } from "../../../components/seller-public/seller-pocket-data";
import { SiteNav } from "../../../components/site/site-nav";
import { collectVariantIds, getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getPocketCopies } from "../../../lib/collection";
import { getGoalProgress } from "../../../lib/goals";
import { getExchangeRates } from "../../../lib/money";
import { getLatestPrices } from "../../../lib/pricing";
import { requireBinderOwner } from "../../../lib/session";
import { getShareLinkForBinder, getSiteUrl } from "../../../lib/share";
import { clampSpreadIndex } from "../../../lib/spreads";
import { getWishlistVariantIds } from "../../../lib/wishlist";

interface PageProps {
  params: Promise<{ binderId: string }>;
  searchParams: Promise<{ spread?: string }>;
}

export default async function BinderViewerPage({ params, searchParams }: PageProps) {
  const { binderId } = await params;
  const viewer = await requireBinderOwner(binderId, `/binders/${binderId}`);
  const { spread: spreadParam } = await searchParams;
  const wishlistVariantIds = await getWishlistVariantIds(viewer.id);

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
  // Fase 7: linked copies are valued from their condition (owner's own value wins).
  const copies = await getPocketCopies(binderData.ownerId, pockets, priceLookup);
  const totalValueUsd = computeBinderValueUsd(pockets, priceLookup, copies.values);

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

  // Seller binders preview their price tags and listing states to the owner too.
  const sellerData =
    binderData.mode === "seller"
      ? await loadSellerPocketData(
          binderId,
          binderData.ownerId,
          pockets,
          displays,
          binderData.currency,
          copies,
        )
      : null;
  const pocketCopies = sellerData?.pocketCopies ?? pocketCopiesByCode(pockets, copies.badges);

  const shareInfo = await getShareLinkForBinder(binderId);
  const siteUrl = getSiteUrl();
  const isPublished = binderData.status === "published";

  return (
    <>
      <SiteNav current="/binders" />
      <ThemedMain theme={binderData.layout.theme}>
        <OwnerToolbar
          binderId={binderId}
          isPublished={isPublished}
          shareInfo={isPublished ? shareInfo : null}
          siteUrl={siteUrl}
          binderName={binderData.name}
          missingHref={
            progress && progress.missingVariantIds.length > 0
              ? `/binders/${binderId}/faltan`
              : undefined
          }
        />

        {/* Compact: the open binder below is the protagonist of this page. */}
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px 24px",
            marginBottom: 20,
          }}
        >
          <BinderTitle>{binderData.name}</BinderTitle>
          {(totalValueUsd > 0 || progress) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
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
          pocketMeta={sellerData?.pocketMeta}
          pocketCopies={pocketCopies}
          wishlistVariantIds={wishlistVariantIds}
          canWish
        />
      </ThemedMain>
    </>
  );
}
