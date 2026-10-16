"use client";

import { animate, type MotionValue, motion, useMotionValue, useTransform } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";

export interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  flipped: boolean;
  width: number;
}

const ASPECT_RATIO = 88 / 63;
const FLIP_VISUAL_DURATION = 0.7;
const FADE_DURATION = 0.15;
const LIFT_SCALE = 1.04;

const hiddenFaceStyle = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
} as const;

// Physical 3D flip: front and back share one preserve-3d plane and the
// container rotates on Y. With reduced motion there is no rotation at all;
// the faces crossfade instead.
export function FlipCard({ front, back, flipped, width }: FlipCardProps) {
  const reduced = usePrefersReducedMotion();
  const height = Math.round(width * ASPECT_RATIO);

  const rotation = useMotionValue(flipped ? 180 : 0);
  // Slight lift at mid-flip, back to rest when the card lands.
  const scale = useTransform(rotation, [0, 90, 180], [1, LIFT_SCALE, 1]);
  // Initial opacities already match `flipped`, so under reduced motion (where
  // the hook resolves after mount) the two faces never show overlapped.
  const frontOpacity = useMotionValue(flipped ? 0 : 1);
  const backOpacity = useMotionValue(flipped ? 1 : 0);
  const reducedApplied = useRef(false);

  useEffect(() => {
    if (reduced) {
      rotation.set(0);
      if (!reducedApplied.current) {
        // First reduced-motion pass after mount: the hook resolves after the
        // first render, so snap to the resting state instead of fading in.
        reducedApplied.current = true;
        frontOpacity.set(flipped ? 0 : 1);
        backOpacity.set(flipped ? 1 : 0);
        return;
      }
      const controls = [
        animate(frontOpacity, flipped ? 0 : 1, { duration: FADE_DURATION, ease: "linear" }),
        animate(backOpacity, flipped ? 1 : 0, { duration: FADE_DURATION, ease: "linear" }),
      ];
      return () => {
        for (const control of controls) {
          control.stop();
        }
      };
    }

    frontOpacity.set(1);
    backOpacity.set(1);
    const controls = animate(rotation, flipped ? 180 : 0, {
      type: "spring",
      visualDuration: FLIP_VISUAL_DURATION,
      bounce: 0,
    });
    return () => controls.stop();
  }, [flipped, reduced, rotation, frontOpacity, backOpacity]);

  return (
    <div style={{ perspective: 1200, width, height, position: "relative" }}>
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          rotateY: rotation,
          scale,
        }}
      >
        <FlipFace testId="flip-card-front" hidden={flipped} opacity={frontOpacity} rotateY={0}>
          {front}
        </FlipFace>
        <FlipFace
          testId="flip-card-back"
          hidden={!flipped}
          opacity={backOpacity}
          rotateY={reduced ? 0 : 180}
        >
          {back}
        </FlipFace>
      </motion.div>
    </div>
  );
}

function FlipFace({
  children,
  hidden,
  opacity,
  rotateY,
  testId,
}: {
  children: ReactNode;
  hidden: boolean;
  opacity: MotionValue<number>;
  rotateY: number;
  testId: string;
}) {
  return (
    <motion.div
      data-testid={testId}
      aria-hidden={hidden || undefined}
      style={{
        ...hiddenFaceStyle,
        position: "absolute",
        inset: 0,
        opacity,
        rotateY,
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      {children}
    </motion.div>
  );
}
