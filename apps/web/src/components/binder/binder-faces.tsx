"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { useState } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { CardFocusOverlay } from "./card-focus-overlay";
import { FaceGrid } from "./face-grid";

export function BinderFaces({
  faces,
  format,
  pockets,
  displays,
}: {
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  displays: Map<string, VariantDisplay>;
}) {
  const [focusedDisplay, setFocusedDisplay] = useState<VariantDisplay | null>(null);

  return (
    <>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {faces.map((face) => (
          <FaceGrid
            key={`${face.sheet}-${face.side}`}
            face={face}
            format={format}
            pockets={pockets}
            displays={displays}
            onCardClick={setFocusedDisplay}
          />
        ))}
      </div>
      {focusedDisplay && (
        <CardFocusOverlay display={focusedDisplay} onClose={() => setFocusedDisplay(null)} />
      )}
    </>
  );
}
