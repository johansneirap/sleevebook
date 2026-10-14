"use client";

import { motion, useMotionTemplate, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";

export interface HoloCardProps {
  imageUrl: string | null;
  name: string;
  variant: string;
  width?: number;
}

const ASPECT_RATIO = 88 / 63;
const MAX_TILT_DEG = 16;

// Foil color stops per catalog variant, swept diagonally and repositioned by
// pointer offset. Reverse is masked to the card's border so the illustration
// stays clear, matching the "foil en el marco" behavior described in
// docs/PRODUCT.md. Conceived independently from first principles (gradient +
// radial glare + pointer-driven 3D tilt) -- not derived from or modeled on
// any third-party holo-card CSS implementation.
const FOIL_GRADIENTS: Record<string, string> = {
  holo: "linear-gradient(115deg, transparent 20%, #ff2fd688 32%, #35e6ff88 46%, #fff94488 60%, #ff2fd688 74%, transparent 86%)",
  reverse:
    "linear-gradient(115deg, transparent 15%, #35c7ff99 35%, #ffffff77 50%, #35c7ff99 65%, transparent 85%)",
  pokeball:
    "linear-gradient(115deg, transparent 15%, #ff445599 35%, #ffffff88 50%, #ff445599 65%, transparent 85%)",
  masterball:
    "linear-gradient(115deg, transparent 15%, #7b2ff799 32%, #f107a399 50%, #7b2ff799 68%, transparent 88%)",
};

const REVERSE_MASK = "radial-gradient(ellipse 58% 58% at center, transparent 55%, black 72%)";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function HoloCard({ imageUrl, name, variant, width = 260 }: HoloCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const rotateX = useSpring(0, { stiffness: 300, damping: 24 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 24 });
  const glareX = useSpring(50, { stiffness: 300, damping: 24 });
  const glareY = useSpring(50, { stiffness: 300, damping: 24 });
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.65), transparent 55%)`;
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
  }

  function handlePointerLeave() {
    rotateX.set(0);
    rotateY.set(0);
    glareX.set(50);
    glareY.set(50);
  }

  const height = Math.round(width * ASPECT_RATIO);
  const foilGradient = FOIL_GRADIENTS[variant];

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

        {!prefersReducedMotion && (
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              background: glareBackground,
              mixBlendMode: "overlay",
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
              mixBlendMode: "color-dodge",
              opacity: 0.85,
              maskImage: variant === "reverse" ? REVERSE_MASK : undefined,
              WebkitMaskImage: variant === "reverse" ? REVERSE_MASK : undefined,
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
