"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { AnimatePresence } from "motion/react";
import { useCallback, useState } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { CardFocusOverlay, type FocusOrigin, measureFocusOrigin } from "./card-focus-overlay";
import { FaceGrid } from "./face-grid";

interface FocusedCard {
  code: string;
  display: VariantDisplay;
  origin: FocusOrigin;
}

export function BinderFaces({
  faces,
  format,
  pockets,
  panels,
  displays,
  sleeve,
}: {
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Map<string, VariantDisplay>;
  sleeve: string;
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
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {faces.map((face) => (
          <FaceGrid
            key={`${face.sheet}-${face.side}`}
            face={face}
            format={format}
            pockets={pockets}
            panels={panels}
            displays={displays}
            sleeve={sleeve}
            focusedCode={focused?.code ?? null}
            onCardClick={handleCardClick}
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
