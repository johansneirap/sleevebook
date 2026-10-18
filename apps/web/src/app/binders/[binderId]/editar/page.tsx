import { formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BinderEditor } from "../../../../components/binder/binder-editor";
import { ThemedMain } from "../../../../components/binder/themed-main";
import { getBinderWithLayout, getVariantDisplays } from "../../../../lib/binders";
import { getLatestPrices } from "../../../../lib/pricing";
import { requireBinderOwner } from "../../../../lib/session";
import { clampSpreadIndex } from "../../../../lib/spreads";

interface PageProps {
  params: Promise<{ binderId: string }>;
  searchParams: Promise<{ spread?: string }>;
}

export default async function BinderEditorPage({ params, searchParams }: PageProps) {
  const { binderId } = await params;
  await requireBinderOwner(binderId, `/binders/${binderId}/editar`);
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

  return (
    <ThemedMain theme={binderData.layout.theme}>
      <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: "0.1em" }}>
        <Link href={`/binders/${binderId}`}>&larr; Ver binder</Link>
      </p>
      <h1
        style={{
          fontSize: "clamp(28px, 4vw, 40px)",
          margin: "0 0 28px",
          lineHeight: 1.1,
        }}
      >
        Editar: {binderData.name}
      </h1>
      <BinderEditor
        binderId={binderId}
        faces={spread.faces}
        format={format}
        pockets={pockets}
        panels={binderData.layout.panels}
        displays={displays}
        prices={prices}
        theme={binderData.layout.theme}
      />
      <nav
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: "1px solid var(--rule)",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          letterSpacing: "0.08em",
        }}
      >
        {index > 0 ? (
          <Link href={`/binders/${binderId}/editar?spread=${index - 1}`}>&larr; Anterior</Link>
        ) : (
          <span style={{ color: "var(--smoke)", opacity: 0.45 }}>&larr; Anterior</span>
        )}
        <span className="sb-data" style={{ color: "var(--smoke)" }}>
          Spread {index + 1} / {spreads.length}
        </span>
        {index < spreads.length - 1 ? (
          <Link href={`/binders/${binderId}/editar?spread=${index + 1}`}>Siguiente &rarr;</Link>
        ) : (
          <span style={{ color: "var(--smoke)", opacity: 0.45 }}>Siguiente &rarr;</span>
        )}
      </nav>
    </ThemedMain>
  );
}
