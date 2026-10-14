import { formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BinderFaces } from "../../../components/binder/binder-faces";
import { ThemedMain } from "../../../components/binder/themed-main";
import { getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
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
  const spread = spreads[index];
  if (!spread) {
    notFound();
  }

  const { format, pockets } = binderData.layout;

  const variantIds = new Set<string>();
  for (const face of spread.faces) {
    for (let i = 1; i <= format.rows * format.cols; i++) {
      const code = formatPocketCode({ sheet: face.sheet, side: face.side, index: i });
      const content = pockets[code];
      if (content?.kind === "card" || content?.kind === "placeholder") {
        variantIds.add(content.variant);
      }
    }
  }
  const displays = await getVariantDisplays([...variantIds]);
  const progress = await getGoalProgress(publicBinder.id);

  return (
    <ThemedMain theme={binderData.layout.theme}>
      <h1>{binderData.name}</h1>
      {progress && (
        <p>
          Avance del objetivo: {progress.owned} / {progress.total} ({progress.percentage}%)
        </p>
      )}
      <BinderFaces
        faces={spread.faces}
        format={format}
        pockets={pockets}
        panels={binderData.layout.panels}
        displays={displays}
        sleeve={binderData.layout.theme.sleeve}
      />
      <nav style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
        {index > 0 ? (
          <Link href={`/s/${slug}?spread=${index - 1}`}>&larr; Anterior</Link>
        ) : (
          <span style={{ color: "#aaa" }}>&larr; Anterior</span>
        )}
        <span>
          Spread {index + 1} / {spreads.length}
        </span>
        {index < spreads.length - 1 ? (
          <Link href={`/s/${slug}?spread=${index + 1}`}>Siguiente &rarr;</Link>
        ) : (
          <span style={{ color: "#aaa" }}>Siguiente &rarr;</span>
        )}
      </nav>
    </ThemedMain>
  );
}
