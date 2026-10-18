"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { AnimatePresence } from "motion/react";
import { Fragment, type ReactNode, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import type { VariantDisplay } from "../../lib/binders";
import type { PocketMetaMap } from "../seller-public/types";
import { CardFocusOverlay, type FocusOrigin, measureFocusOrigin } from "./card-focus-overlay";
import { FaceGrid, faceSizeVars } from "./face-grid";
import type { OpeningAxis } from "./page-curl";

interface FocusedCard {
  code: string;
  display: VariantDisplay;
  origin: FocusOrigin;
}

// The open binder lies on the leather: its spine/gutter shadow sits between
// the two slots. Each spread always has two slots -- the first and last show
// the inside cover opposite their single face -- so the spine never moves and
// a turning sheet lands exactly on the opposite slot. "side" opening puts the
// slots in a row, "top" stacks them with a horizontal gutter. Phones always
// stack and drop the empty inside cover.
const SPREAD_CSS = `
.sb-spread {
  display: grid;
  grid-template-columns: auto 28px auto;
  align-items: stretch;
  justify-content: center;
  box-sizing: border-box;
  padding: 28px;
  border-radius: 6px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--leather) 92%, #000), var(--leather-deep));
  box-shadow:
    0 50px 90px -40px rgba(0, 0, 0, 0.75),
    0 18px 30px -18px rgba(0, 0, 0, 0.6),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
.sb-spine {
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.45) 42%,
    rgba(0, 0, 0, 0.6) 50%,
    rgba(0, 0, 0, 0.45) 58%,
    rgba(0, 0, 0, 0) 100%
  );
}
.sb-cover {
  box-sizing: border-box;
  border-radius: 2px;
  background:
    radial-gradient(ellipse at 70% 0%, rgba(255, 240, 210, 0.05), transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--leather-deep) 80%, #000), var(--leather-deep));
  outline: 1px solid color-mix(in srgb, var(--foil) 10%, transparent);
  outline-offset: -8px;
}
.sb-spread[data-axis="top"] {
  grid-template-columns: auto;
  grid-template-rows: 1fr 28px 1fr;
}
.sb-spread[data-axis="top"] .sb-spine {
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.45) 42%,
    rgba(0, 0, 0, 0.6) 50%,
    rgba(0, 0, 0, 0.45) 58%,
    rgba(0, 0, 0, 0) 100%
  );
}
@media (max-width: 640px) {
  .sb-spread {
    grid-template-columns: auto;
    grid-template-rows: 1fr 28px 1fr;
    padding: 14px;
  }
  .sb-spine {
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.45) 42%,
      rgba(0, 0, 0, 0.6) 50%,
      rgba(0, 0, 0, 0.45) 58%,
      rgba(0, 0, 0, 0) 100%
    );
  }
  .sb-spread[data-cover] {
    grid-template-rows: auto;
  }
  .sb-spread[data-cover] .sb-cover,
  .sb-spread[data-cover] .sb-spine {
    display: none;
  }
}
`;

// Only mounted after a card is focused, so document is always available.
function OverlayPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

/**
 * The two slots of a spread: the opening spread pairs the inside front cover
 * (null) with sheet 1's front, the closing one sheet N's back with the inside
 * back cover.
 */
export function spreadSlots(faces: SheetFace[]): [SheetFace | null, SheetFace | null] {
  if (faces.length >= 2) {
    return [faces[0] ?? null, faces[1] ?? null];
  }
  const only = faces[0] ?? null;
  return only?.side === "B" ? [only, null] : [null, only];
}

/** The bare inside of the cover, opposite the first/last face. */
export function InsideCover({ turnSlot, format }: { turnSlot?: number; format: Format }) {
  return (
    <div
      aria-hidden
      className="sb-face sb-cover"
      data-turn-slot={turnSlot}
      style={faceSizeVars(format)}
    />
  );
}

export function BinderFaces({
  faces,
  format,
  pockets,
  panels,
  displays,
  sleeve,
  opening = "side",
  pocketMeta,
}: {
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Map<string, VariantDisplay>;
  sleeve: string;
  opening?: OpeningAxis;
  /** Seller mode only; absent keeps the collection look. */
  pocketMeta?: PocketMetaMap;
}) {
  // Tracks the pocket code (not just the display) so the same variant placed in
  // two pockets returns to the right one.
  const [focused, setFocused] = useState<FocusedCard | null>(null);

  const handleCardClick = useCallback((code: string, display: VariantDisplay, rect: DOMRect) => {
    setFocused({ code, display, origin: measureFocusOrigin(rect) });
  }, []);

  const handleClose = useCallback(() => setFocused(null), []);
  const slots = spreadSlots(faces);

  return (
    <>
      <div className="sb-spread" data-axis={opening} data-cover={slots.includes(null) || undefined}>
        <style>{SPREAD_CSS}</style>
        {slots.map((face, i) => (
          <Fragment key={face ? `${face.sheet}-${face.side}` : `cover-${i}`}>
            {i === 1 && <div className="sb-spine" aria-hidden />}
            {face ? (
              <FaceGrid
                face={face}
                format={format}
                pockets={pockets}
                panels={panels}
                displays={displays}
                sleeve={sleeve}
                focusedCode={focused?.code ?? null}
                onCardClick={handleCardClick}
                turnSlot={i}
                pocketMeta={pocketMeta}
              />
            ) : (
              <InsideCover turnSlot={i} format={format} />
            )}
          </Fragment>
        ))}
      </div>
      <AnimatePresence>
        {focused && (
          // Portaled to <body>: the stage's isolation would otherwise trap the
          // overlay under fixed page chrome such as the seller tray.
          <OverlayPortal key={focused.code}>
            <CardFocusOverlay
              display={focused.display}
              sleeve={sleeve}
              origin={focused.origin}
              onClose={handleClose}
              pocketCode={focused.code}
              pocketMeta={pocketMeta?.[focused.code]}
            />
          </OverlayPortal>
        )}
      </AnimatePresence>
    </>
  );
}
