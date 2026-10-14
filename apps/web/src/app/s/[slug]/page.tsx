import { generateSpreads } from "@sleevebook/binder-core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BinderPageTurner } from "../../../components/binder/binder-page-turner";
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

  return (
    <ThemedMain theme={binderData.layout.theme}>
      <h1>{binderData.name}</h1>
      {progress && (
        <p>
          Avance del objetivo: {progress.owned} / {progress.total} ({progress.percentage}%)
        </p>
      )}
      <BinderPageTurner
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
    </ThemedMain>
  );
}
