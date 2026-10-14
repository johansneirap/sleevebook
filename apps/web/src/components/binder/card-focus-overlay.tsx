"use client";

import { useEffect } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { HoloCard } from "./holo-card";

export function CardFocusOverlay({
  display,
  sleeve,
  onClose,
}: {
  display: VariantDisplay;
  sleeve: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <button
        type="button"
        aria-label="Cerrar vista de carta"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          border: "none",
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <HoloCard
            imageUrl={display.imageUrl}
            name={display.name}
            variant={display.variant}
            sleeve={sleeve}
            width={320}
          />
        </div>
        <p style={{ color: "white", fontSize: 14, pointerEvents: "auto" }}>
          {display.setName} — {display.name} {display.number} ({display.variant})
        </p>
      </div>
    </div>
  );
}
