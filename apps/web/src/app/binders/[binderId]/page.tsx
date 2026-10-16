import { computeBinderValueUsd, generateSpreads } from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BinderStage } from "../../../components/binder/binder-stage";
import { ThemedMain } from "../../../components/binder/themed-main";
import { collectVariantIds, getBinderWithLayout, getVariantDisplays } from "../../../lib/binders";
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
      />
    </ThemedMain>
  );
}
