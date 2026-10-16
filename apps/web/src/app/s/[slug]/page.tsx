import { generateSpreads } from "@sleevebook/binder-core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BinderTitle, ProgressFigure } from "../../../components/binder/binder-header";
import { BinderStage } from "../../../components/binder/binder-stage";
import { ThemedMain } from "../../../components/binder/themed-main";
import { collectVariantIds, getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getGoalProgress } from "../../../lib/goals";
import { getPublishedBinderBySlug, incrementShareViews } from "../../../lib/share";
import { clampSpreadIndex } from "../../../lib/spreads";

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

  return (
    <ThemedMain theme={binderData.layout.theme}>
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "clamp(20px, 4vw, 32px)",
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
          {closed && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                top: "45%",
                transform: "translate(-50%, -50%)",
                width: "min(980px, 140%)",
                height: "120%",
                pointerEvents: "none",
                background:
                  "radial-gradient(closest-side, color-mix(in srgb, var(--foil) 12%, transparent), transparent 70%)",
              }}
            />
          )}
          <div style={{ position: "relative" }}>
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
            />
          </div>
        </div>
      </section>
    </ThemedMain>
  );
}
