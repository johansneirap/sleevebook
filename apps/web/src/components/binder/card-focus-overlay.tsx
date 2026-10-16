"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import { HoloCard } from "./holo-card";

export const CARD_FOCUS_WIDTH = 320;

/** Offset and scale that map the enlarged card onto a pocket's on-screen rect. */
export interface FocusOrigin {
  x: number;
  y: number;
  scale: number;
}

/**
 * Measures where a pocket sits relative to the viewport center, so the enlarged
 * card (centered by the overlay) can start exactly on top of the pocket.
 */
export function measureFocusOrigin(rect: DOMRect): FocusOrigin {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  return {
    x: rect.left + rect.width / 2 - viewportWidth / 2,
    y: rect.top + rect.height / 2 - viewportHeight / 2,
    scale: rect.width / CARD_FOCUS_WIDTH,
  };
}

const SPRING = { type: "spring", duration: 0.6, bounce: 0 } as const;
const BACKDROP_FADE = { duration: 0.5, ease: "easeOut" } as const;
const REDUCED_FADE = { duration: 0.15, ease: "easeOut" } as const;

export function CardFocusOverlay({
  display,
  sleeve,
  origin,
  onClose,
}: {
  display: VariantDisplay;
  sleeve: string;
  origin: FocusOrigin;
  onClose: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const caption = `${display.setName} — ${display.name} ${display.number} (${display.variant})`;

  // The overlay is unmounted by AnimatePresence in BinderFaces; the exit
  // animations of its descendants run first, so the card shrinks back into
  // its pocket before the overlay disappears.
  const cardMotion = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: REDUCED_FADE,
      }
    : {
        initial: { x: origin.x, y: origin.y, scale: origin.scale, opacity: 1 },
        animate: { x: 0, y: 0, scale: 1, opacity: 1 },
        exit: { x: origin.x, y: origin.y, scale: origin.scale, opacity: 1 },
        transition: SPRING,
      };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      style={{ position: "fixed", inset: 0, zIndex: 50 }}
    >
      <motion.button
        type="button"
        aria-label="Cerrar vista de carta"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reducedMotion ? REDUCED_FADE : BACKDROP_FADE}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <motion.div
          data-testid="focused-card"
          initial={cardMotion.initial}
          animate={cardMotion.animate}
          exit={cardMotion.exit}
          transition={cardMotion.transition}
          style={{ width: CARD_FOCUS_WIDTH, pointerEvents: "auto", willChange: "transform" }}
        >
          <HoloCard
            imageUrl={display.imageUrl}
            name={display.name}
            variant={display.variant}
            sleeve={sleeve}
            width={CARD_FOCUS_WIDTH}
          />
        </motion.div>
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reducedMotion ? REDUCED_FADE : BACKDROP_FADE}
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 24,
          margin: 0,
          textAlign: "center",
          color: "white",
          fontSize: 14,
          pointerEvents: "none",
        }}
      >
        {caption}
      </motion.p>
    </div>
  );
}
