import { generateSpreads } from "@sleevebook/binder-core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BinderTitle, ProgressFigure } from "../../../components/binder/binder-header";
import { BinderStage } from "../../../components/binder/binder-stage";
import { ThemedMain } from "../../../components/binder/themed-main";
import { SellerContactButtons } from "../../../components/seller-public/seller-contact-buttons";
import { loadSellerPocketData } from "../../../components/seller-public/seller-pocket-data";
import { SellerTray } from "../../../components/seller-public/seller-tray";
import { SellerPublicProvider } from "../../../components/seller-public/want-list";
import { collectVariantIds, getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getGoalProgress } from "../../../lib/goals";
import { getCurrentUser } from "../../../lib/session";
import { getPublishedBinderBySlug, incrementShareViews } from "../../../lib/share";
import { clampSpreadIndex } from "../../../lib/spreads";
import { getWishlistVariantIds } from "../../../lib/wishlist";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ spread?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const publicBinder = await getPublishedBinderBySlug(slug);
  if (!publicBinder) {
    return {};
  }
  return {
    title: publicBinder.name,
    robots: publicBinder.visibility === "unlisted" ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicBinderPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { spread: spreadParam } = await searchParams;

  const publicBinder = await getPublishedBinderBySlug(slug);
  if (!publicBinder) {
    notFound();
  }
  await incrementShareViews(slug);

  const binderData = await getBinderWithLayout(publicBinder.id);
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
  const progress = await getGoalProgress(publicBinder.id);
  const closed = spreadParam === undefined;
  // Signed-in viewers get the "mis deseos" toggle on the cards.
  const viewer = await getCurrentUser();
  const wishlistVariantIds = viewer ? await getWishlistVariantIds(viewer.id) : undefined;
  // Seller mode only: collection binders never load listings or prices here.
  const sellerData =
    binderData.mode === "seller"
      ? await loadSellerPocketData(publicBinder.id, pockets, displays, binderData.currency)
      : null;

  const body = (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "clamp(20px, 4vw, 32px)",
        ...(sellerData ? { paddingBottom: 120 } : {}),
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
        <BinderTitle>{binderData.name}</BinderTitle>
        {progress && (
          <ProgressFigure
            owned={progress.owned}
            total={progress.total}
            percentage={progress.percentage}
          />
        )}
        {sellerData && (
          <>
            <SellerContactButtons heading />
            {sellerData.priceNote && (
              <p className="sb-data" style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                {sellerData.priceNote}
              </p>
            )}
          </>
        )}
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          paddingBlock: 8,
        }}
      >
        <div style={{ position: "relative", width: "100%" }}>
          <BinderStage
            name={binderData.name}
            theme={binderData.layout.theme}
            startClosed={closed}
            basePath={`/s/${slug}`}
            initialIndex={index}
            sheets={binderData.sheets}
            opening={binderData.layout.opening}
            format={format}
            pockets={pockets}
            panels={binderData.layout.panels}
            displays={displays}
            sleeve={binderData.layout.theme.sleeve}
            pocketMeta={sellerData?.pocketMeta}
            wishlistVariantIds={wishlistVariantIds}
            canWish={Boolean(viewer)}
          />
        </div>
      </div>
    </section>
  );

  return (
    <ThemedMain theme={binderData.layout.theme}>
      {sellerData ? (
        <SellerPublicProvider
          slug={slug}
          binderName={binderData.name}
          currency={binderData.currency}
          contact={binderData.sellerContact}
          catalog={sellerData.catalog}
        >
          {body}
          <SellerTray />
        </SellerPublicProvider>
      ) : (
        body
      )}
    </ThemedMain>
  );
}
