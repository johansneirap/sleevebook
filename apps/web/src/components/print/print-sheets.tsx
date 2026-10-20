import type { CSSProperties } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { PAPER_SIZES, type PaperId, PRINT_GAP_MM, type PrintPiece } from "./print-model";

// Printable sheets. On screen they are previews on the velvet ground; in
// print (@media print) they become exact paper with 63 x 88 mm pieces, one
// printed sheet per page. No UI chrome is rendered inside these elements.

const CARD_W = "63mm";
const CARD_H = "88mm";

export function printSheetCss(paper: PaperId): string {
  const size = PAPER_SIZES[paper];
  return `
@page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
.sb-print-sheet {
  box-sizing: border-box;
  display: grid;
  place-content: center;
  grid-template-columns: repeat(3, ${CARD_W});
  grid-auto-rows: ${CARD_H};
  gap: ${PRINT_GAP_MM}mm;
  background: #fff;
  color: #000;
  width: ${size.widthMm}mm;
  height: ${size.heightMm}mm;
  margin: 0 auto 32px;
}
.sb-print-piece {
  position: relative;
  width: ${CARD_W};
  height: ${CARD_H};
}
.sb-print-piece-body {
  position: absolute;
  inset: 0;
  overflow: hidden;
  box-sizing: border-box;
  font-family: var(--font-ui), Helvetica, Arial, sans-serif;
}
.sb-print-sheet svg {
  display: block;
  width: 100%;
  height: 100%;
}
@media screen {
  .sb-print-sheet {
    width: min(100%, ${size.widthMm}mm);
    height: auto;
    aspect-ratio: ${size.widthMm} / ${size.heightMm};
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: auto;
    gap: 4%;
    padding: 6%;
    box-sizing: border-box;
    border-radius: 2px;
    box-shadow: 0 1px 2px rgba(27, 32, 51, 0.06), 0 8px 24px rgba(27, 32, 51, 0.1);
    margin: 0 auto 40px;
  }
  .sb-print-piece {
    width: 100%;
    height: auto;
    aspect-ratio: 63 / 88;
  }
}
@media print {
  html, body { background: #fff !important; }
  .sb-no-print { display: none !important; }
  .sb-print-sheet {
    margin: 0;
    box-shadow: none;
    break-after: page;
    page-break-after: always;
  }
  .sb-print-sheet:last-of-type {
    break-after: auto;
    page-break-after: auto;
  }
}
`;
}

interface CropMarksProps {
  show: boolean;
}

/** Thin crop marks in the gutter around a piece; they never touch the card. */
function CropMarks({ show }: CropMarksProps) {
  if (!show) {
    return null;
  }
  const arm = (style: CSSProperties) => (
    <span
      aria-hidden
      style={{
        position: "absolute",
        background: "#000",
        ...style,
      }}
    />
  );
  const H = { height: "0.2mm", width: "2.5mm" } as const;
  const V = { width: "0.2mm", height: "2.5mm" } as const;
  return (
    <>
      {arm({ ...H, left: "-3.5mm", top: "-0.1mm" })}
      {arm({ ...V, top: "-3.5mm", left: "-0.1mm" })}
      {arm({ ...H, right: "-3.5mm", top: "-0.1mm" })}
      {arm({ ...V, top: "-3.5mm", right: "-0.1mm" })}
      {arm({ ...H, left: "-3.5mm", bottom: "-0.1mm" })}
      {arm({ ...V, bottom: "-3.5mm", left: "-0.1mm" })}
      {arm({ ...H, right: "-3.5mm", bottom: "-0.1mm" })}
      {arm({ ...V, bottom: "-3.5mm", right: "-0.1mm" })}
    </>
  );
}

interface FichaProps {
  piece: PrintPiece;
  display: VariantDisplay | undefined;
  qrSvg: string | null;
}

const TEXT_BASE: CSSProperties = {
  margin: 0,
  color: "#000",
  textAlign: "center",
  lineHeight: 1.2,
};

function FichaContent({ piece, display, qrSvg }: FichaProps) {
  const code = (
    <span
      className="sb-data"
      style={{
        fontFamily: "var(--font-data), ui-monospace, monospace",
        fontSize: "8pt",
        fontWeight: 700,
      }}
    >
      {piece.code}
    </span>
  );
  const name = display ? display.name : "Carta sin datos";
  const detail = display ? `${display.setName} · ${display.number}` : "";

  if (piece.style === "vacio-con-borde") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "0.3mm solid #000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {code}
      </div>
    );
  }

  if (piece.style === "minimal") {
    return (
      <div
        style={{
          position: "absolute",
          inset: "4mm",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2mm",
        }}
      >
        <p style={{ ...TEXT_BASE, fontSize: "9pt", fontWeight: 600 }}>{name}</p>
        {code}
      </div>
    );
  }

  if (piece.style === "silueta") {
    return (
      <>
        {display?.imageUrl && (
          // biome-ignore lint/performance/noImgElement: printed art is a remote catalog URL, no next/image domain config
          <img
            src={display.imageUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(1)",
              opacity: 0.35,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: "4mm",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p style={{ ...TEXT_BASE, fontSize: "10pt", fontWeight: 700 }}>{name}</p>
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1mm" }}
          >
            {code}
            <p style={{ ...TEXT_BASE, fontSize: "7pt" }}>{detail}</p>
          </div>
        </div>
      </>
    );
  }

  // "ficha" (default): the full label a collector needs to find the card.
  return (
    <div
      style={{
        position: "absolute",
        inset: "4mm",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "2mm",
        }}
      >
        {code}
        {display?.rarity && (
          <span style={{ fontSize: "6.5pt", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {display.rarity}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.2mm" }}>
        <p style={{ margin: 0, fontSize: "11pt", fontWeight: 700, lineHeight: 1.15 }}>{name}</p>
        <p style={{ margin: 0, fontSize: "7.5pt" }}>{detail}</p>
        {display && (
          <p style={{ margin: 0, fontSize: "7pt", fontStyle: "italic" }}>
            Variante: {display.variant}
          </p>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
        {qrSvg && (
          <span
            role="img"
            aria-label="Código QR al binder publicado"
            style={{ display: "block", width: "13mm", height: "13mm" }}
            // The SVG is generated on the server from our own share URL.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: server-generated QR svg from our own share URL
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
      </div>
    </div>
  );
}

function PanelContent({ piece }: { piece: PrintPiece }) {
  const box = piece.panelBox;
  return (
    <>
      {piece.panelAsset && box && (
        // biome-ignore lint/performance/noImgElement: arbitrary pasted panel URL, no next/image domain allowlist
        <img
          src={piece.panelAsset}
          alt=""
          style={{
            position: "absolute",
            left: `${box.left}mm`,
            top: `${box.top}mm`,
            width: `${box.width}mm`,
            height: `${box.height}mm`,
            maxWidth: "none",
            objectFit: "cover",
          }}
        />
      )}
      <span
        className="sb-data"
        style={{
          position: "absolute",
          left: "1mm",
          bottom: "1mm",
          background: "#fff",
          fontFamily: "var(--font-data), ui-monospace, monospace",
          fontSize: "6pt",
          padding: "0 0.6mm",
        }}
      >
        {piece.code}
      </span>
    </>
  );
}

export interface PrintSheetsProps {
  sheets: PrintPiece[][];
  paper: PaperId;
  displays: Map<string, VariantDisplay>;
  qrSvg: string | null;
}

export function PrintSheets({ sheets, paper, displays, qrSvg }: PrintSheetsProps) {
  return (
    <>
      {sheets.map((pieces, sheetIndex) => (
        <section
          key={pieces[0]?.code ?? `sheet-${sheetIndex}`}
          className="sb-print-sheet"
          data-testid="print-sheet"
          data-paper={paper}
          aria-label={`Hoja de impresión ${sheetIndex + 1} de ${sheets.length}`}
        >
          {pieces.map((piece) => {
            const isPanel = piece.kind === "panel";
            const display = piece.variant ? displays.get(piece.variant) : undefined;
            return (
              <div
                key={`${piece.kind}-${piece.code}`}
                className="sb-print-piece"
                data-testid={isPanel ? "print-panel-piece" : "print-ficha"}
                data-code={piece.code}
                data-style={piece.style}
              >
                <CropMarks show />
                <div className="sb-print-piece-body">
                  {isPanel ? (
                    <PanelContent piece={piece} />
                  ) : (
                    <FichaContent piece={piece} display={display} qrSvg={qrSvg} />
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
