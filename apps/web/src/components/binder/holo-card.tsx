"use client";

import { motion, useMotionTemplate, useSpring, useTransform } from "motion/react";
import { useRef } from "react";
import { sleeveOverlayStyle } from "../../lib/theme-presets";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";

export interface HoloCardProps {
  imageUrl: string | null;
  name: string;
  variant: string;
  sleeve?: string;
  width?: number;
}

const ASPECT_RATIO = 88 / 63;
const MAX_TILT_DEG = 12;

// Foil color stops per catalog variant, swept diagonally and repositioned by
// pointer offset. Conceived independently from first principles (gradient +
// radial glare + pointer-driven 3D tilt) -- not derived from or modeled on
// any third-party holo-card CSS implementation.
//
// Real foil only lives in part of the card: a holo rare shines in the art
// window, a reverse (and the Poké Ball / Master Ball patterns) everywhere
// except it. The masks keep the effect off the text box so the card never
// reads washed out, and both glare and foil fade in only while the card is
// being tilted -- at rest it looks like the printed card.
const FOIL_GRADIENTS: Record<string, string> = {
  holo: "linear-gradient(115deg, transparent 18%, #ff4fd8 30%, #4fe3ff 42%, #fff36b 54%, #7dff9b 64%, #ff4fd8 76%, transparent 88%)",
  reverse:
    "linear-gradient(115deg, transparent 15%, #6fd3ff 34%, #f4f8ff 50%, #6fd3ff 66%, transparent 85%)",
  pokeball:
    "linear-gradient(115deg, transparent 15%, #ff6b78 34%, #fff1f1 50%, #ff6b78 66%, transparent 85%)",
  masterball:
    "linear-gradient(115deg, transparent 15%, #9b6bff 32%, #ff6bd0 50%, #9b6bff 68%, transparent 88%)",
};

// Standard layout: the illustration sits in the upper half, slightly above centre.
const ART_WINDOW = "radial-gradient(ellipse 46% 25% at 50% 31%, black 72%, transparent 100%)";
const OUTSIDE_ART_WINDOW =
  "radial-gradient(ellipse 46% 25% at 50% 31%, transparent 80%, black 100%)";
const FOIL_MASKS: Record<string, string> = {
  holo: ART_WINDOW,
  reverse: OUTSIDE_ART_WINDOW,
  pokeball: OUTSIDE_ART_WINDOW,
  masterball: OUTSIDE_ART_WINDOW,
};

export function HoloCard({
  imageUrl,
  name,
  variant,
  sleeve = "clear",
  width = 260,
}: HoloCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const sleeveStyle = sleeveOverlayStyle(sleeve);

  const rotateX = useSpring(0, { stiffness: 300, damping: 24 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 24 });
  const glareX = useSpring(50, { stiffness: 300, damping: 24 });
  const glareY = useSpring(50, { stiffness: 300, damping: 24 });
  // 0 at rest, 1 while the pointer tilts the card.
  const active = useSpring(0, { stiffness: 160, damping: 26 });
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,250,240,0.5), rgba(255,250,240,0.12) 22%, transparent 48%)`;
  const glareOpacity = useTransform(active, [0, 1], [0, 0.7]);
  const foilOpacity = useTransform(active, [0, 1], [0.08, 0.42]);
  const foilPosition = useMotionTemplate`${glareX}% ${glareY}%`;

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!ref.current) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * MAX_TILT_DEG);
    rotateX.set((0.5 - py) * MAX_TILT_DEG);
    glareX.set(px * 100);
    glareY.set(py * 100);
    active.set(1);
  }

  function handlePointerLeave() {
    rotateX.set(0);
    rotateY.set(0);
    glareX.set(50);
    glareY.set(50);
    active.set(0);
  }

  const height = Math.round(width * ASPECT_RATIO);
  const foilGradient = FOIL_GRADIENTS[variant];
  const foilMask = FOIL_MASKS[variant];

  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
        ref={ref}
        onPointerMove={prefersReducedMotion ? undefined : handlePointerMove}
        onPointerLeave={prefersReducedMotion ? undefined : handlePointerLeave}
        style={{
          width,
          height,
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          rotateX: prefersReducedMotion ? 0 : rotateX,
          rotateY: prefersReducedMotion ? 0 : rotateY,
        }}
      >
        {imageUrl ? (
          // biome-ignore lint/performance/noImgElement: the holo overlay layers need direct pixel control, no next/image config yet
          <img
            src={imageUrl}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#ddd" }} />
        )}

        {sleeveStyle && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", ...sleeveStyle }} />
        )}

        {!prefersReducedMotion && (
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: glareBackground,
              mixBlendMode: "soft-light",
              opacity: glareOpacity,
            }}
          />
        )}

        {!prefersReducedMotion && foilGradient && (
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: foilGradient,
              backgroundSize: "220% 220%",
              backgroundPosition: foilPosition,
              pointerEvents: "none",
              mixBlendMode: "overlay",
              opacity: foilOpacity,
              maskImage: foilMask,
              WebkitMaskImage: foilMask,
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
