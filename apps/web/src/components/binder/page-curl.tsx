"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export type TurnDirection = "forward" | "backward";
export type OpeningAxis = "side" | "top";

interface PageCurlProps {
  opening: OpeningAxis;
  direction: TurnDirection;
  children: ReactNode;
}

// A page is split into two segments along the hinge axis: a larger "flat"
// segment near the hinge that barely bends, and a smaller "tip" segment at
// the free edge that curls further -- the classic cheap approximation of a
// paper curl without a mesh/canvas deformation. The tip is a DOM child of
// the flat segment (not a sibling) so its own rotation composes with the
// flat segment's rotation in the same 3D space (transform-style: preserve-3d
// makes CSS 3D transforms nest instead of flatten).
const FLAT_FRACTION = 0.6;
const TIP_FRACTION = 1 - FLAT_FRACTION;
const FLAT_ROTATION_DEG = 130;
const TIP_EXTRA_ROTATION_DEG = 55;
const DURATION_S = 0.55;
const TIP_DELAY_S = 0.07;

const shadowLayerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

function flatBoxStyle(isSide: boolean, hingeAtEnd: boolean): CSSProperties {
  if (isSide) {
    return {
      position: "absolute",
      top: 0,
      height: "100%",
      width: `${FLAT_FRACTION * 100}%`,
      transformStyle: "preserve-3d",
      transformOrigin: hingeAtEnd ? "100% 50%" : "0% 50%",
      ...(hingeAtEnd ? { right: 0 } : { left: 0 }),
    };
  }
  return {
    position: "absolute",
    left: 0,
    width: "100%",
    height: `${FLAT_FRACTION * 100}%`,
    transformStyle: "preserve-3d",
    transformOrigin: hingeAtEnd ? "50% 100%" : "50% 0%",
    ...(hingeAtEnd ? { bottom: 0 } : { top: 0 }),
  };
}

function flatContentStyle(isSide: boolean, hingeAtEnd: boolean): CSSProperties {
  const shiftPct = (-(1 - FLAT_FRACTION) / FLAT_FRACTION) * 100;
  if (isSide) {
    return {
      position: "relative",
      width: `${(1 / FLAT_FRACTION) * 100}%`,
      height: "100%",
      left: hingeAtEnd ? `${shiftPct}%` : "0%",
    };
  }
  return {
    position: "relative",
    height: `${(1 / FLAT_FRACTION) * 100}%`,
    width: "100%",
    top: hingeAtEnd ? `${shiftPct}%` : "0%",
  };
}

function tipBoxStyle(isSide: boolean, hingeAtEnd: boolean): CSSProperties {
  if (isSide) {
    return {
      position: "absolute",
      top: 0,
      height: "100%",
      width: `${TIP_FRACTION * 100}%`,
      transformStyle: "preserve-3d",
      transformOrigin: hingeAtEnd ? "100% 50%" : "0% 50%",
      ...(hingeAtEnd ? { right: "100%" } : { left: "100%" }),
    };
  }
  return {
    position: "absolute",
    left: 0,
    width: "100%",
    height: `${TIP_FRACTION * 100}%`,
    transformStyle: "preserve-3d",
    transformOrigin: hingeAtEnd ? "50% 100%" : "50% 0%",
    ...(hingeAtEnd ? { bottom: "100%" } : { top: "100%" }),
  };
}

function tipContentStyle(isSide: boolean, hingeAtEnd: boolean): CSSProperties {
  const shiftPct = (-FLAT_FRACTION / TIP_FRACTION) * 100;
  if (isSide) {
    return {
      position: "relative",
      width: `${(1 / TIP_FRACTION) * 100}%`,
      height: "100%",
      left: hingeAtEnd ? "0%" : `${shiftPct}%`,
    };
  }
  return {
    position: "relative",
    height: `${(1 / TIP_FRACTION) * 100}%`,
    width: "100%",
    top: hingeAtEnd ? "0%" : `${shiftPct}%`,
  };
}

function shadeGradient(isSide: boolean, towardStart: boolean): string {
  const toward = isSide
    ? towardStart
      ? "to left"
      : "to right"
    : towardStart
      ? "to top"
      : "to bottom";
  return `linear-gradient(${toward}, rgba(0,0,0,0.5), rgba(0,0,0,0) 70%)`;
}

export function PageCurl({ opening, direction, children }: PageCurlProps) {
  const isSide = opening === "side";
  // Forward hinges at the trailing edge (right for side, bottom for top),
  // matching the familiar e-reader "swipe forward" convention; backward
  // hinges at the opposite (leading) edge.
  const hingeAtEnd = direction === "forward";
  const sign = hingeAtEnd ? -1 : 1;
  const flatRotate = isSide
    ? { rotateY: sign * FLAT_ROTATION_DEG }
    : { rotateX: sign * FLAT_ROTATION_DEG };
  const tipRotate = isSide
    ? { rotateY: sign * TIP_EXTRA_ROTATION_DEG }
    : { rotateX: sign * TIP_EXTRA_ROTATION_DEG };
  const rotateInitial = isSide ? { rotateY: 0 } : { rotateX: 0 };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Invisible, normal-flow copy: sizes this wrapper to the outgoing
          spread's own natural dimensions (which can differ from the new
          spread's, e.g. a 1-face spread turning into a 2-face one), so the
          flat/tip segments' percentage-based geometry below resolves
          against the right box instead of stretching to match whatever the
          real (already-updated) content now measures. */}
      <div style={{ visibility: "hidden" }}>{children}</div>
      <motion.div
        style={flatBoxStyle(isSide, hingeAtEnd)}
        initial={rotateInitial}
        animate={flatRotate}
        transition={{ duration: DURATION_S, ease: "easeIn" }}
      >
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <div style={flatContentStyle(isSide, hingeAtEnd)}>{children}</div>
        </div>
        <motion.div
          style={{ ...shadowLayerStyle, background: shadeGradient(isSide, !hingeAtEnd) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: DURATION_S, times: [0, 0.55, 1] }}
        />
        <motion.div
          style={tipBoxStyle(isSide, hingeAtEnd)}
          initial={rotateInitial}
          animate={tipRotate}
          transition={{ duration: DURATION_S, delay: TIP_DELAY_S, ease: "easeIn" }}
        >
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <div style={tipContentStyle(isSide, hingeAtEnd)}>{children}</div>
          </div>
          <motion.div
            style={{ ...shadowLayerStyle, background: shadeGradient(isSide, hingeAtEnd) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.65, 0] }}
            transition={{ duration: DURATION_S, delay: TIP_DELAY_S, times: [0, 0.55, 1] }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
