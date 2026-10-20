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

// Screen chrome is v2 "Estante" (light app UI). The @media print block and the
// 63 x 88 mm geometry (print-sheets.tsx) are untouched.
const PAGE_CSS = `
.sb-print-page {
  box-sizing: border-box;
  max-width: 980px;
  margin: 0 auto;
  padding: 20px 16px 112px;
  font-family: var(--font-ui);
  color: var(--ink);
}
@media (min-width: 720px) {
  .sb-print-page { padding: 32px 40px 112px; }
}
.sb-print-back {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 10px;
  margin-left: -10px;
  border-radius: 10px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.sb-print-back:hover { background: var(--accent-soft); }
.sb-print-eyebrow {
  margin: 16px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.sb-print-title {
  margin: 4px 0 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--ink);
}
.sb-print-lead {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
}
.sb-print-card {
  margin-top: 20px;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}
.sb-print-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  font-size: 14px;
  color: var(--ink);
}
.sb-print-controls label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-weight: 600;
}
.sb-print-controls input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--accent);
}
.sb-print-controls select {
  font: inherit;
  font-size: 14px;
  min-height: 44px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0 12px;
}
.sb-print-controls .sb-print-apply {
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  min-height: 44px;
  color: var(--accent);
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 12px;
  padding: 0 16px;
  cursor: pointer;
}
.sb-print-controls .sb-print-apply:hover { background: var(--accent-soft); }
.sb-print-summary {
  font-size: 14px;
  color: var(--muted);
}
.sb-print-faces {
  margin-top: 24px;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}
.sb-print-faces-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}
.sb-print-faces ul {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: grid;
}
.sb-print-faces li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  min-height: 44px;
  padding: 4px 0;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
  color: var(--ink);
}
.sb-print-faces li:last-child { border-bottom: 0; }
.sb-print-faces a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.sb-print-faces a:hover { text-decoration: underline; }
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
          <Link href={`/binders/${binderId}`} className="sb-print-back">
            &larr; Volver al binder
          </Link>
        </p>
        <p className="sb-print-eyebrow">Impresión</p>
        <h1 className="sb-print-title">{binderData.name}</h1>
        <p className="sb-print-lead">
          Cada ficha mide 63 × 88 mm y lleva su código de bolsillo para saber dónde va. Imprime al
          100 % (sin ajustar a la página) o usa &ldquo;Guardar como PDF&rdquo;.
        </p>

        <div className="sb-print-card">
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
            <button type="submit" className="sb-print-apply">
              Aplicar
            </button>
          </form>

          <div className="sb-print-controls" style={{ marginTop: 16 }}>
            <PrintButton />
            <span className="sb-print-summary">
              {fichaCount} {fichaCount === 1 ? "ficha" : "fichas"}
              {includePanels ? ` · ${pieces.length - fichaCount} piezas de panel` : ""} ·{" "}
              {sheets.length} {sheets.length === 1 ? "hoja" : "hojas"} {paperInfo.label}
            </span>
          </div>
        </div>
      </div>

      <div className="sb-print-area" style={{ marginTop: 28 }}>
        {sheets.length === 0 ? (
          <p className="sb-no-print" style={{ color: "var(--muted)", fontSize: 14 }}>
            No hay fichas para imprimir con estas opciones.
          </p>
        ) : (
          <PrintSheets sheets={sheets} paper={paper} displays={displays} qrSvg={qrSvg} />
        )}
      </div>

      <section className="sb-print-faces sb-no-print" aria-labelledby="sb-print-faces-title">
        <p className="sb-print-faces-title">
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
