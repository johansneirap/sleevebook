"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { AnimatePresence } from "motion/react";
import { Fragment, type ReactNode, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { VariantDisplay } from "../../lib/binders";
import { toggleWishlist } from "../../lib/wishlist-actions";
import type { PocketMetaMap } from "../seller-public/types";
import { CardFocusOverlay, type FocusOrigin, measureFocusOrigin } from "./card-focus-overlay";
import { FaceGrid, faceSizeVars } from "./face-grid";
import type { OpeningAxis } from "./page-curl";
import type { PocketCopyMap } from "./pocket-copy-badge";

interface FocusedCard {
  code: string;
  display: VariantDisplay;
  origin: FocusOrigin;
}

// The binder object: a cover (theme color from --binder-cover, faint linen
// texture, dashed stitching), two paper leaves and a spine with three metal
// rings between them. Each spread always has two slots -- the first and last
// show the inside cover opposite their single face -- so the spine never moves
// and a turning sheet lands exactly on the opposite slot. "side" opening puts
// the slots in a row, "top" stacks them with a horizontal spine.
// The single-page mode (phones) is the same object seen as one leaf, with the
// spine and rings down its left edge.
const BINDER_CSS = `
.sb-spread {
  position: relative;
  display: grid;
  grid-template-columns: auto 46px auto;
  align-items: stretch;
  justify-content: center;
  box-sizing: border-box;
  padding: 22px 26px;
  border-radius: 18px;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 3px),
    radial-gradient(ellipse at 30% 0%, rgba(255, 255, 255, 0.14), transparent 60%),
    linear-gradient(160deg, var(--binder-cover, #2f4a8a), var(--binder-cover-deep, #1d2e56));
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.15),
    0 30px 60px -20px rgba(27, 32, 51, 0.45),
    0 12px 24px -12px rgba(27, 32, 51, 0.35);
}
/* Dashed stitching, inset from the edge of the cover. */
.sb-spread::before {
  content: "";
  position: absolute;
  inset: 9px;
  border-radius: 12px;
  border: 1.5px dashed rgba(255, 255, 255, 0.24);
  pointer-events: none;
}
.sb-spine {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.28),
    rgba(0, 0, 0, 0.05) 40%,
    rgba(0, 0, 0, 0.05) 60%,
    rgba(0, 0, 0, 0.28)
  );
}
.sb-ring {
  width: 40px;
  height: 26px;
  box-sizing: border-box;
  border-radius: 14px;
  border: 5px solid #c9cdd6;
  border-top-color: #eef0f4;
  border-bottom-color: #9aa0ad;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.35);
}
.sb-cover {
  box-sizing: border-box;
  border-radius: 4px;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 3px),
    linear-gradient(160deg, color-mix(in srgb, var(--binder-cover, #2f4a8a) 80%, #fff), var(--binder-cover, #2f4a8a));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), inset 0 0 24px rgba(0, 0, 0, 0.18);
}
.sb-spread[data-axis="top"] {
  grid-template-columns: auto;
  grid-template-rows: 1fr 46px 1fr;
}
.sb-spread[data-axis="top"] .sb-spine {
  flex-direction: row;
  justify-content: space-around;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.28),
    rgba(0, 0, 0, 0.05) 40%,
    rgba(0, 0, 0, 0.05) 60%,
    rgba(0, 0, 0, 0.28)
  );
}
.sb-spread[data-axis="top"] .sb-ring {
  transform: rotate(90deg);
}
/* One leaf at a time (phones): cover edge + rings on the left, one page. */
.sb-spread--single {
  display: flex;
  align-items: stretch;
  padding: 12px 12px 12px 0;
  border-radius: 14px;
}
.sb-spread--single .sb-spine {
  width: 26px;
  flex: 0 0 26px;
  align-items: flex-end;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.05));
}
.sb-spread--single .sb-ring {
  width: 24px;
  height: 18px;
  border-width: 4px;
  margin-right: -10px;
}
.sb-spread--single::before {
  display: none;
}
.sb-spread--single .sb-face {
  flex: 1 1 auto;
  width: auto !important;
  min-width: 0;
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
  single = false,
  pocketMeta,
  pocketCopies,
  wishlistVariantIds,
  canWish = false,
}: {
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Map<string, VariantDisplay>;
  sleeve: string;
  opening?: OpeningAxis;
  /** Phones: one leaf at a time, with the spine on its left edge. */
  single?: boolean;
  /** Seller mode only; absent keeps the collection look. */
  pocketMeta?: PocketMetaMap;
  /** Fase 7: copy chips per pocket code (collection and seller views). */
  pocketCopies?: PocketCopyMap;
  /** Variants already on the viewer's wishlist (signed-in viewers only). */
  wishlistVariantIds?: string[];
  /** Shows the "mis deseos" toggle in the card overlay. */
  canWish?: boolean;
}) {
  // Tracks the pocket code (not just the display) so the same variant placed in
  // two pockets returns to the right one.
  const [focused, setFocused] = useState<FocusedCard | null>(null);
  const [wished, setWished] = useState<ReadonlySet<string>>(
    () => new Set(wishlistVariantIds ?? []),
  );
  // Mirrors `wished` so rapid toggles compute from the latest optimistic state.
  const wishedRef = useRef(wished);

  const applyWished = useCallback((variantId: string, inList: boolean) => {
    const next = new Set(wishedRef.current);
    if (inList) {
      next.add(variantId);
    } else {
      next.delete(variantId);
    }
    wishedRef.current = next;
    setWished(next);
  }, []);

  const handleWishToggle = useCallback(
    (variantId: string) => {
      const nextInList = !wishedRef.current.has(variantId);
      applyWished(variantId, nextInList);
      toggleWishlist(variantId)
        .then(({ inList }) => {
          if (inList !== nextInList) {
            applyWished(variantId, inList);
          }
        })
        .catch(() => applyWished(variantId, !nextInList));
    },
    [applyWished],
  );

  const handleCardClick = useCallback((code: string, display: VariantDisplay, rect: DOMRect) => {
    setFocused({ code, display, origin: measureFocusOrigin(rect) });
  }, []);

  const handleClose = useCallback(() => setFocused(null), []);
  const slots = single ? [faces[0] ?? null, null] : spreadSlots(faces);
  const SIDES = ["left", "right"] as const;

  return (
    <>
      <div
        className={single ? "sb-spread sb-spread--single" : "sb-spread"}
        data-axis={opening}
        data-single={single || undefined}
      >
        <style>{BINDER_CSS}</style>
        {single ? (
          <>
            <div className="sb-spine" aria-hidden>
              <RingStack />
            </div>
            {slots[0] && (
              <FaceGrid
                face={slots[0]}
                format={format}
                pockets={pockets}
                panels={panels}
                displays={displays}
                sleeve={sleeve}
                focusedCode={focused?.code ?? null}
                onCardClick={handleCardClick}
                side="right"
                pocketMeta={pocketMeta}
                pocketCopies={pocketCopies}
              />
            )}
          </>
        ) : (
          slots.map((face, i) => (
            <Fragment key={face ? `${face.sheet}-${face.side}` : `cover-${i}`}>
              {i === 1 && (
                <div className="sb-spine" aria-hidden>
                  <RingStack />
                </div>
              )}
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
                  side={SIDES[i]}
                  pocketMeta={pocketMeta}
                  pocketCopies={pocketCopies}
                />
              ) : (
                <InsideCover turnSlot={i} format={format} />
              )}
            </Fragment>
          ))
        )}
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
              copy={pocketCopies?.[focused.code]}
              wish={
                canWish
                  ? {
                      inList: wished.has(focused.display.id),
                      onToggle: () => handleWishToggle(focused.display.id),
                    }
                  : undefined
              }
            />
          </OverlayPortal>
        )}
      </AnimatePresence>
    </>
  );
}

function RingStack() {
  return (
    <>
      <span className="sb-ring" />
      <span className="sb-ring" />
      <span className="sb-ring" />
    </>
  );
}
