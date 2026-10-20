import { formatPocketCode, type Layout, panelCoverageMap } from "@sleevebook/binder-core";
import type { CSSProperties } from "react";
import { resolveThemeTokens, sleeveOverlayStyle } from "../../lib/theme-presets";

interface TemplatePreviewProps {
  rows: number;
  cols: number;
  theme: Layout["theme"];
  panels: Layout["panels"];
  /** Compact spread (cards) or the larger one on the template's own page. */
  size?: "card" | "detail";
}

// Only plain same-origin paths or https URLs go into the inline url(); a
// template is public, so its art is never trusted as raw CSS.
function safeAssetUrl(asset: string): string | null {
  return /^(\/|https:\/\/)[^"'()\\\s]+$/.test(asset) ? asset : null;
}

function pageGrid(rows: number, cols: number, sheet: number, side: "F" | "B") {
  return { rows, cols, sheet, side };
}

/**
 * CSS-only mock of an open spread (front and back of sheet 1): the theme's
 * background, the sleeve sheen over each pocket, and the panels' art cropped
 * to the area they cover. No cards, no JS.
 */
export function TemplatePreview({
  rows,
  cols,
  theme,
  panels,
  size = "card",
}: TemplatePreviewProps) {
  const tokens = resolveThemeTokens(theme);
  const sheen = sleeveOverlayStyle(theme.sleeve);
  const coverage = panelCoverageMap(panels, { rows, cols });

  const pages = [pageGrid(rows, cols, 1, "F"), pageGrid(rows, cols, 1, "B")];

  return (
    <div
      className={`sb-tpl-spread sb-tpl-spread-${size}`}
      role="img"
      aria-label={`Vista previa: ${rows} por ${cols}, tema ${tokens.label}`}
    >
      {pages.map((page) => {
        const cells = [];
        for (let index = 1; index <= rows * cols; index++) {
          const code = formatPocketCode({ sheet: page.sheet, side: page.side, index });
          const covered = coverage.get(code);
          if (covered && !covered.isAnchor) {
            continue;
          }
          const row = Math.floor((index - 1) / cols) + 1;
          const col = ((index - 1) % cols) + 1;
          const panel = covered?.isAnchor ? covered.panel : null;
          const asset = panel ? safeAssetUrl(panel.asset) : null;
          const style: CSSProperties = {
            gridRow: panel ? `${row} / span ${panel.span.rows}` : `${row}`,
            gridColumn: panel ? `${col} / span ${panel.span.cols}` : `${col}`,
            ...(asset
              ? {
                  backgroundImage: `url("${asset}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {}),
            ...(panel ? {} : sheen),
          };
          cells.push(<span key={code} className="sb-tpl-cell" style={style} />);
        }
        return (
          <div
            key={`${page.sheet}${page.side}`}
            className="sb-tpl-page"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              aspectRatio: `${cols * 63} / ${rows * 88}`,
            }}
          >
            {cells}
          </div>
        );
      })}
    </div>
  );
}
