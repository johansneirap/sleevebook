"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { AnimatePresence } from "motion/react";
import { useCallback, useState } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { CardFocusOverlay, type FocusOrigin, measureFocusOrigin } from "./card-focus-overlay";
import { FaceGrid } from "./face-grid";
import type { OpeningAxis } from "./page-curl";

interface FocusedCard {
  code: string;
  display: VariantDisplay;
  origin: FocusOrigin;
}

// The open binder lies on the leather: its spine/gutter shadow sits between
// the two faces. "side" opening puts faces in a row, "top" opening stacks
// them with a horizontal gutter. Phones always stack.
const SPREAD_CSS = `
.sb-spread {
  display: flex;
  flex-direction: row;
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
.sb-spread[data-axis="top"] {
  flex-direction: column;
}
.sb-spine {
  flex: 0 0 auto;
  width: 28px;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.45) 42%,
    rgba(0, 0, 0, 0.6) 50%,
    rgba(0, 0, 0, 0.45) 58%,
    rgba(0, 0, 0, 0) 100%
  );
}
.sb-spread[data-axis="top"] .sb-spine {
  width: auto;
  height: 28px;
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
    flex-direction: column;
    padding: 14px;
  }
  .sb-spine {
    width: auto;
    height: 28px;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.45) 42%,
      rgba(0, 0, 0, 0.6) 50%,
      rgba(0, 0, 0, 0.45) 58%,
      rgba(0, 0, 0, 0) 100%
    );
  }
}
`;

export function BinderFaces({
  faces,
  format,
  pockets,
  panels,
  displays,
  sleeve,
  opening = "side",
}: {
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Map<string, VariantDisplay>;
  sleeve: string;
  opening?: OpeningAxis;
}) {
  // Tracks the pocket code (not just the display) so the same variant placed in
  // two pockets returns to the right one.
  const [focused, setFocused] = useState<FocusedCard | null>(null);

  const handleCardClick = useCallback((code: string, display: VariantDisplay, rect: DOMRect) => {
    setFocused({ code, display, origin: measureFocusOrigin(rect) });
  }, []);

  const handleClose = useCallback(() => setFocused(null), []);

  return (
    <>
      <div className="sb-spread" data-axis={opening}>
        <style>{SPREAD_CSS}</style>
        {faces.map((face, i) => (
          <FaceGridWithSpine
            key={`${face.sheet}-${face.side}`}
            face={face}
            format={format}
            pockets={pockets}
            panels={panels}
            displays={displays}
            sleeve={sleeve}
            focusedCode={focused?.code ?? null}
            onCardClick={handleCardClick}
            spineBefore={i === 1}
          />
        ))}
      </div>
      <AnimatePresence>
        {focused && (
          <CardFocusOverlay
            key={focused.code}
            display={focused.display}
            sleeve={sleeve}
            origin={focused.origin}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FaceGridWithSpine({
  spineBefore,
  ...props
}: Parameters<typeof FaceGrid>[0] & { spineBefore: boolean }) {
  return (
    <>
      {spineBefore && <div className="sb-spine" aria-hidden />}
      <FaceGrid {...props} />
    </>
  );
}
