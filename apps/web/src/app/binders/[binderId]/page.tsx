import { formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaceGrid } from "../../../components/binder/face-grid";
import { getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getGoalProgress } from "../../../lib/goals";
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
  const progress = await getGoalProgress(binderId);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/binders">&larr; Mis binders</Link>
      </p>
      <h1>{binderData.name}</h1>
      <p>
        <Link href={`/binders/${binderId}/editar`}>Editar</Link>
      </p>
      {progress && (
        <p>
          Avance del objetivo: {progress.owned} / {progress.total} ({progress.percentage}%)
          {progress.missingVariantIds.length > 0 && (
            <>
              {" — "}
              <Link href={`/binders/${binderId}/faltan`}>Ver lo que falta</Link>
            </>
          )}
        </p>
      )}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {spread.faces.map((face) => (
          <FaceGrid
            key={`${face.sheet}-${face.side}`}
            face={face}
            format={format}
            pockets={pockets}
            displays={displays}
          />
        ))}
      </div>
      <nav style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
        {index > 0 ? (
          <Link href={`/binders/${binderId}?spread=${index - 1}`}>&larr; Anterior</Link>
        ) : (
          <span style={{ color: "#aaa" }}>&larr; Anterior</span>
        )}
        <span>
          Spread {index + 1} / {spreads.length}
        </span>
        {index < spreads.length - 1 ? (
          <Link href={`/binders/${binderId}?spread=${index + 1}`}>Siguiente &rarr;</Link>
        ) : (
          <span style={{ color: "#aaa" }}>Siguiente &rarr;</span>
        )}
      </nav>
    </main>
  );
}
