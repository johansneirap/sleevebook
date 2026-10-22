import {
  formatPocketCode,
  generateSpreads,
  gradingLabel,
  placeCopies,
} from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BinderEditor, type EditorCopy } from "../../../../components/binder/binder-editor";
import { getBinderWithLayout, getVariantDisplays } from "../../../../lib/binders";
import { listCopies, loadUserLayouts } from "../../../../lib/collection";
import { getLatestPrices } from "../../../../lib/pricing";
import { requireBinderOwner } from "../../../../lib/session";
import { clampSpreadIndex } from "../../../../lib/spreads";

interface PageProps {
  params: Promise<{ binderId: string }>;
  searchParams: Promise<{ spread?: string }>;
}

const NAV_LINK = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
} as const;

const NAV_DISABLED = {
  ...NAV_LINK,
  color: "var(--muted)",
  opacity: 0.6,
  background: "var(--surface-2)",
} as const;

export default async function BinderEditorPage({ params, searchParams }: PageProps) {
  const { binderId } = await params;
  const owner = await requireBinderOwner(binderId, `/binders/${binderId}/editar`);
  const { spread: spreadParam } = await searchParams;

  const binderData = await getBinderWithLayout(binderId);
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
  const displaysMap = await getVariantDisplays([...variantIds]);
  const displays = Object.fromEntries(displaysMap);

  const allVariantIds = new Set<string>();
  for (const content of Object.values(pockets)) {
    if (content.kind === "card") {
      allVariantIds.add(content.variant);
    }
  }
  const pricesMap = await getLatestPrices([...allVariantIds]);
  const prices = Object.fromEntries(
    Object.entries(pricesMap).map(([id, price]) => [id, price.amountUsd]),
  );

  // Fase 7: the owner's copies of the cards in this binder, and where each one
  // sits (any binder of theirs), for the copy section and the pocket badges.
  const [allCopies, layouts] = await Promise.all([listCopies(owner.id), loadUserLayouts(owner.id)]);
  const placements = placeCopies(layouts);
  const binderNames = new Map(layouts.map((layout) => [layout.binderId, layout.binderName]));
  const copies: EditorCopy[] = allCopies
    .filter((copy) => allVariantIds.has(copy.variantId))
    .map((copy) => {
      const placed = placements.get(copy.id);
      return {
        id: copy.id,
        variantId: copy.variantId,
        language: copy.language,
        condition: copy.condition,
        grading: gradingLabel(copy),
        placedIn: placed
          ? {
              binderId: placed.binderId,
              binderName: binderNames.get(placed.binderId) ?? "",
              pocketCode: placed.pocketCode,
            }
          : null,
      };
    });

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "var(--bg)",
        color: "var(--ink)",
        padding: "20px 16px 112px",
      }}
    >
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gap: 16 }}>
        <Link
          href={`/binders/${binderId}`}
          style={{
            width: "max-content",
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            color: "var(--accent)",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          &larr; Ver binder
        </Link>
        <header style={{ display: "grid", gap: 4 }}>
          <h1
            className="sb-display"
            style={{ margin: 0, fontSize: "clamp(24px, 3.4vw, 28px)", lineHeight: 1.2 }}
          >
            Editar: {binderData.name}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            Mueve, asigna y ordena las cartas de cada hoja.
          </p>
        </header>
        <BinderEditor
          key={`${binderId}-${index}`}
          binderId={binderId}
          binderName={binderData.name}
          faces={spread.faces}
          format={format}
          pockets={pockets}
          panels={binderData.layout.panels}
          displays={displays}
          prices={prices}
          theme={binderData.layout.theme}
          copies={copies}
        />
        <nav
          aria-label="Páginas del editor"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 8,
          }}
        >
          {index > 0 ? (
            <Link href={`/binders/${binderId}/editar?spread=${index - 1}`} style={NAV_LINK}>
              &larr; Anterior
            </Link>
          ) : (
            <span style={NAV_DISABLED}>&larr; Anterior</span>
          )}
          <span className="sb-data" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
            Spread {index + 1} / {spreads.length}
          </span>
          {index < spreads.length - 1 ? (
            <Link href={`/binders/${binderId}/editar?spread=${index + 1}`} style={NAV_LINK}>
              Siguiente &rarr;
            </Link>
          ) : (
            <span style={NAV_DISABLED}>Siguiente &rarr;</span>
          )}
        </nav>
      </div>
    </main>
  );
}
