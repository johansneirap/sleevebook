import { generateSpreads } from "@sleevebook/binder-core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BinderStage } from "../../../components/binder/binder-stage";
import { pocketCopiesByCode } from "../../../components/binder/pocket-copy-badge";
import { ThemedMain } from "../../../components/binder/themed-main";
import { collectVariantIds, getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getPocketCopies } from "../../../lib/collection";
import { getPublishedBinderBySlug } from "../../../lib/share";
import { clampSpreadIndex } from "../../../lib/spreads";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ spread?: string }>;
}

// Embeds duplicate the public page inside someone else's site: keep them out of search.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const publicBinder = await getPublishedBinderBySlug(slug);
  if (!publicBinder) {
    return {};
  }
  return {
    title: `${publicBinder.name} — Sleevebook`,
    robots: { index: false, follow: false },
  };
}

// Chrome-less viewer for <iframe> embeds. Deliberately does not increment the
// share views counter: those count visits to the public page, not embed loads.
export default async function EmbedBinderPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { spread: spreadParam } = await searchParams;

  const publicBinder = await getPublishedBinderBySlug(slug);
  if (!publicBinder) {
    notFound();
  }

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
  const closed = spreadParam === undefined;
  const copies = await getPocketCopies(binderData.ownerId, pockets, {});

  return (
    <ThemedMain theme={binderData.layout.theme}>
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "4px 16px",
          }}
        >
          <h1
            className="sb-display"
            style={{
              margin: 0,
              fontSize: "clamp(20px, 3.4vw, 24px)",
              lineHeight: 1.15,
              fontWeight: 800,
              color: "var(--ink)",
              overflowWrap: "anywhere",
            }}
          >
            {binderData.name}
          </h1>
          <a
            href={`/s/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sb-label"
            style={{ fontSize: 12, color: "var(--muted)", textDecoration: "underline" }}
          >
            Ver en Sleevebook
          </a>
        </header>

        <div
          style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}
        >
          <div style={{ position: "relative", maxWidth: "100%" }}>
            <BinderStage
              name={binderData.name}
              theme={binderData.layout.theme}
              startClosed={closed}
              basePath={`/e/${slug}`}
              initialIndex={index}
              sheets={binderData.sheets}
              opening={binderData.layout.opening}
              format={format}
              pockets={pockets}
              panels={binderData.layout.panels}
              displays={displays}
              sleeve={binderData.layout.theme.sleeve}
              pocketCopies={pocketCopiesByCode(pockets, copies.badges)}
            />
          </div>
        </div>
      </section>
    </ThemedMain>
  );
}
