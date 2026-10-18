import type { SheetFace } from "@sleevebook/binder-core";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "../../../../components/print/print-button";
import {
  buildPrintPieces,
  chunkPieces,
  faceLabel,
  faceParam,
  PAPER_SIZES,
  PRINT_GRID,
  parsePaper,
} from "../../../../components/print/print-model";
import { PrintSheets, printSheetCss } from "../../../../components/print/print-sheets";
import {
  collectVariantIds,
  getBinderWithLayout,
  getVariantDisplays,
} from "../../../../lib/binders";
import { requireBinderOwner } from "../../../../lib/session";
import { getShareLinkForBinder, getSiteUrl } from "../../../../lib/share";

interface PageProps {
  params: Promise<{ binderId: string }>;
  searchParams: Promise<{ papel?: string; paneles?: string; faltantes?: string }>;
}

const PAGE_CSS = `
.sb-print-page {
  max-width: 980px;
  margin: 0 auto;
  padding: 56px 16px 112px;
  box-sizing: border-box;
  font-family: var(--font-ui);
  color: var(--linen);
}
.sb-print-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 22px;
  margin: 32px 0 0;
  font-size: 13px;
  color: var(--smoke);
}
.sb-print-controls label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.sb-print-controls select {
  font: inherit;
  color: var(--linen);
  background: var(--velvet-raised);
  border: 1px solid var(--rule);
  border-radius: 2px;
  padding: 4px 8px;
}
.sb-print-controls button {
  font: inherit;
  font-size: 12px;
  color: var(--linen);
  background: none;
  border: 1px solid var(--linen);
  border-radius: 2px;
  padding: 6px 12px;
  cursor: pointer;
}
.sb-print-faces {
  margin-top: 56px;
  border-top: 1px solid var(--rule);
  padding-top: 20px;
}
.sb-print-faces ul {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: grid;
  gap: 4px;
}
.sb-print-faces li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--linen) 8%, transparent);
  font-size: 14px;
}
.sb-print-faces a {
  color: var(--smoke);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.sb-print-faces a:hover,
.sb-print-faces a:focus-visible {
  color: var(--foil);
}
@media print {
  html, body { background: #fff !important; }
  .sb-print-page { padding: 0 !important; margin: 0 !important; max-width: none !important; color: #000; }
  .sb-print-area { margin: 0 !important; }
  .sb-no-print { display: none !important; }
}
`;

export default async function PrintBinderPage({ params, searchParams }: PageProps) {
  const { binderId } = await params;
  await requireBinderOwner(binderId, `/binders/${binderId}/imprimir`);
  const query = await searchParams;

  const binderData = await getBinderWithLayout(binderId);
  if (!binderData) {
    notFound();
  }

  const paper = parsePaper(query.papel);
  const includePanels = query.paneles === "1";
  const onlyMissing = query.faltantes === "1";
  const { layout } = binderData;

  const pieces = buildPrintPieces(layout, { includePanels, onlyMissing });
  const sheets = chunkPieces(pieces, PRINT_GRID.cols * PRINT_GRID.rows);
  const displays = await getVariantDisplays(collectVariantIds(layout.pockets));

  // The QR only makes sense for a published binder with a known site URL.
  const shareInfo = await getShareLinkForBinder(binderId);
  const siteUrl = getSiteUrl();
  const isPublished = binderData.status === "published";
  const qrSvg =
    isPublished && shareInfo && siteUrl
      ? await QRCode.toString(`${siteUrl}/s/${shareInfo.slug}`, {
          type: "svg",
          margin: 0,
          errorCorrectionLevel: "M",
        })
      : null;

  const faces: SheetFace[] = [];
  for (let sheet = 1; sheet <= binderData.sheets; sheet++) {
    faces.push({ sheet, side: "F" }, { sheet, side: "B" });
  }

  const fichaCount = pieces.filter((piece) => piece.kind === "placeholder").length;
  const paperInfo = PAPER_SIZES[paper];

  return (
    <main className="sb-print-page">
      <style>{PAGE_CSS}</style>
      <style>{printSheetCss(paper)}</style>

      <div className="sb-no-print">
        <p style={{ margin: 0 }}>
          <Link
            href={`/binders/${binderId}`}
            style={{
              color: "var(--smoke)",
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            &larr; Volver al binder
          </Link>
        </p>
        <p className="sb-label" style={{ margin: "28px 0 0", fontSize: 12, color: "var(--smoke)" }}>
          Impresión
        </p>
        <h1
          style={{
            margin: "10px 0 0",
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: "clamp(36px, 6vw, 56px)",
            lineHeight: 1.05,
            color: "var(--linen)",
          }}
        >
          {binderData.name}
        </h1>
        <p style={{ margin: "14px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--smoke)" }}>
          Cada ficha mide 63 × 88 mm y lleva su código de bolsillo para saber dónde va. Imprime al
          100 % (sin ajustar a la página) o usa &ldquo;Guardar como PDF&rdquo;.
        </p>

        <form method="get" className="sb-print-controls">
          <label>
            Papel
            <select name="papel" defaultValue={paper}>
              <option value="a4">A4</option>
              <option value="carta">Carta</option>
            </select>
          </label>
          <label>
            <input type="checkbox" name="paneles" value="1" defaultChecked={includePanels} />
            Incluir paneles
          </label>
          <label>
            <input type="checkbox" name="faltantes" value="1" defaultChecked={onlyMissing} />
            Solo faltantes
          </label>
          <button type="submit">Aplicar</button>
        </form>

        <div className="sb-print-controls" style={{ marginTop: 18 }}>
          <PrintButton />
          <span>
            {fichaCount} {fichaCount === 1 ? "ficha" : "fichas"}
            {includePanels ? ` · ${pieces.length - fichaCount} piezas de panel` : ""} ·{" "}
            {sheets.length} {sheets.length === 1 ? "hoja" : "hojas"} {paperInfo.label}
          </span>
        </div>
      </div>

      <div className="sb-print-area" style={{ marginTop: 36 }}>
        {sheets.length === 0 ? (
          <p className="sb-no-print" style={{ color: "var(--smoke)", fontSize: 14 }}>
            No hay fichas para imprimir con estas opciones.
          </p>
        ) : (
          <PrintSheets sheets={sheets} paper={paper} displays={displays} qrSvg={qrSvg} />
        )}
      </div>

      <section className="sb-print-faces sb-no-print" aria-labelledby="sb-print-faces-title">
        <p className="sb-label" style={{ margin: 0, fontSize: 12, color: "var(--smoke)" }}>
          <span id="sb-print-faces-title">Imágenes por cara</span>
        </p>
        <ul>
          {faces.map((face) => (
            <li key={faceParam(face)}>
              <span>{faceLabel(face)}</span>
              <a href={`/binders/${binderId}/cara/${faceParam(face)}/imagen?download=1`}>
                Descargar imagen
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
