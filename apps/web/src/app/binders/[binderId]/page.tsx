import { computeBinderValueUsd, formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BinderFaces } from "../../../components/binder/binder-faces";
import { ThemedMain } from "../../../components/binder/themed-main";
import { getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
import { getGoalProgress } from "../../../lib/goals";
import { getLatestPrices } from "../../../lib/pricing";
import { getShareLinkForBinder, getSiteUrl } from "../../../lib/share";
import { publishBinder, unpublishBinder } from "../../../lib/share-actions";
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

  const shareInfo = await getShareLinkForBinder(binderId);
  const siteUrl = getSiteUrl();

  return (
    <ThemedMain theme={binderData.layout.theme}>
      <p>
        <Link href="/binders">&larr; Mis binders</Link>
      </p>
      <h1>{binderData.name}</h1>
      <p>
        <Link href={`/binders/${binderId}/editar`}>Editar</Link>
      </p>
      {totalValueUsd > 0 && <p>Valor total: ${totalValueUsd.toFixed(2)} USD</p>}

      {binderData.status === "published" && shareInfo ? (
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          <p>
            Publicado ({shareInfo.visibility === "public" ? "público" : "no listado"}) —{" "}
            <a href={`${siteUrl}/s/${shareInfo.slug}`} target="_blank" rel="noreferrer">
              {siteUrl}/s/{shareInfo.slug}
            </a>{" "}
            ({shareInfo.views} vistas)
          </p>
          <form action={publishBinder} style={{ display: "inline" }}>
            <input type="hidden" name="binderId" value={binderId} />
            <select aria-label="Visibilidad" name="visibility" defaultValue={shareInfo.visibility}>
              <option value="unlisted">No listado</option>
              <option value="public">Público</option>
            </select>
            <button type="submit">Actualizar</button>
          </form>{" "}
          <form action={unpublishBinder} style={{ display: "inline" }}>
            <input type="hidden" name="binderId" value={binderId} />
            <button type="submit">Despublicar</button>
          </form>
        </div>
      ) : (
        <form action={publishBinder} style={{ fontSize: 13, marginBottom: 12 }}>
          <input type="hidden" name="binderId" value={binderId} />
          <select aria-label="Visibilidad" name="visibility" defaultValue="unlisted">
            <option value="unlisted">No listado</option>
            <option value="public">Público</option>
          </select>
          <button type="submit">Publicar</button>
        </form>
      )}
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
      <BinderFaces
        faces={spread.faces}
        format={format}
        pockets={pockets}
        displays={displays}
        sleeve={binderData.layout.theme.sleeve}
      />
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
    </ThemedMain>
  );
}
