"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export type TurnDirection = "forward" | "backward";
export type OpeningAxis = "side" | "top";

/** A box in the turn overlay's coordinate space (relative to its container). */
export interface SlotRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Measures the `[data-turn-slot]` children of `container` (slot 0 is the
 * left/top face, slot 1 the right/bottom one) relative to the container.
 * Hidden slots (e.g. the inside cover on phones) come back as null.
 */
export function measureTurnSlots(container: HTMLElement): Array<SlotRect | null> {
  const base = container.getBoundingClientRect();
  const slots: Array<SlotRect | null> = [null, null];
  for (const el of container.querySelectorAll<HTMLElement>("[data-turn-slot]")) {
    const index = Number(el.dataset.turnSlot);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (index === 0 || index === 1)) {
      slots[index] = {
        left: r.left - base.left,
        top: r.top - base.top,
        width: r.width,
        height: r.height,
      };
    }
  }
  return slots;
}

/**
 * Where a turning sheet starts and lands: forward lifts the right/bottom face
 * (slot 1) over the spine onto slot 0, backward the reverse. When one slot is
 * hidden the sheet flips in place over the visible one.
 */
export function turnGeometry(
  slots: Array<SlotRect | null>,
  direction: TurnDirection,
): { src: SlotRect; dest: SlotRect } | null {
  const [start, end] = slots;
  const src = direction === "forward" ? (end ?? start) : (start ?? end);
  const dest = direction === "forward" ? (start ?? end) : (end ?? start);
  return src && dest ? { src, dest } : null;
}

// The sheet is a chain of strips: a wide flat one at the spine, then thin
// strips toward the free edge, each a DOM child of the previous so their
// rotations compose (transform-style: preserve-3d). Every outer strip bends a
// little at the same time, so the free edge curls in a smooth arc -- the paper
// wave -- instead of folding at one hard crease, and the bend returns to 0 so
// the sheet lands flat, exactly over the opposite face.
const FLAT_FRACTION = 0.45;
const CURL_STRIPS = 7;
const TURN_DEG = 180;
const CURL_BEND_DEG = 42;
// Strips overlap by this much so no hairline seam shows between them.
const STRIP_OVERLAP_PX = 1;
const DURATION_S = 0.75;
const EASE = [0.42, 0.04, 0.2, 1] as const;
export const PAGE_TURN_MS = DURATION_S * 1000;

const BACKFACE: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

interface PageTurnProps {
  src: SlotRect;
  dest: SlotRect;
  /** The face that lifts off `src` (front of the turning sheet). */
  front: ReactNode;
  /** The other side of the sheet, which ends up face-up over `dest`. */
  back: ReactNode;
  /** What `dest` showed before the turn; the sheet comes to rest over it. */
  under?: ReactNode;
}

export function PageTurn({ src, dest, front, back, under }: PageTurnProps) {
  const dx = dest.left + dest.width / 2 - (src.left + src.width / 2);
  const dy = dest.top + dest.height / 2 - (src.top + src.height / 2);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const toStart = (horizontal ? dx : dy) <= 0;

  const size = horizontal ? src.width : src.height;
  const srcPos = horizontal ? src.left : src.top;
  const destPos = horizontal ? dest.left : dest.top;
  const destSize = horizontal ? dest.width : dest.height;
  // Half the spine gap; negative when the sheet flips in place.
  const halfGap = toStart ? (srcPos - (destPos + destSize)) / 2 : (destPos - (srcPos + size)) / 2;
  const inPlace = halfGap < 0;
  const flat = inPlace ? size : size * FLAT_FRACTION;

  // Positive rotateY lifts the left edge toward the viewer, positive rotateX
  // the bottom edge; pick the sign that brings the free edge up off the page.
  const sign = horizontal ? (toStart ? -1 : 1) : toStart ? 1 : -1;
  const rotate = horizontal ? "rotateY" : "rotateX";
  const pos = horizontal ? "left" : "top";
  const len = horizontal ? "width" : "height";
  const hinge = toStart ? srcPos - halfGap : srcPos + size + halfGap;

  const origin = (offset: number) => (horizontal ? `${offset}px 50%` : `50% ${offset}px`);
  const segment = (at: number, length: number, originAt: number): CSSProperties => ({
    position: "absolute",
    [pos]: at,
    [len]: length,
    ...(horizontal ? { top: 0, height: src.height } : { left: 0, width: src.width }),
    transformStyle: "preserve-3d",
    transformOrigin: origin(originAt),
  });
  // A window onto the full face, shifted so the strip shows its own slice.
  // The shading spans the whole sheet and is shifted the same way, so it runs
  // continuously across strips (no light/dark seam at the joints).
  const face = (node: ReactNode, offset: number, isBack: boolean) => {
    const sheet: CSSProperties = {
      position: "absolute",
      [pos]: offset,
      ...(horizontal ? { top: 0 } : { left: 0 }),
      width: src.width,
      height: src.height,
    };
    const toward = horizontal
      ? toStart !== isBack
        ? "to right"
        : "to left"
      : toStart !== isBack
        ? "to bottom"
        : "to top";
    return (
      <div style={{ ...BACKFACE, transform: isBack ? `${rotate}(180deg)` : undefined }}>
        <div style={{ ...sheet, display: "flex" }}>{node}</div>
        <motion.div
          style={{
            ...sheet,
            pointerEvents: "none",
            background: `linear-gradient(${toward}, rgba(27,32,51,0.22), rgba(27,32,51,0.06) 55%, rgba(27,32,51,0))`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ duration: DURATION_S, times: [0, 0.5, 1] }}
        />
      </div>
    );
  };

  // Strip intervals along the turn axis, measured from the src face's start,
  // ordered from the spine outward. Each strip pivots on its spine-side edge
  // (the first one on the hinge); rendered intervals overlap by a pixel.
  const bounds = inPlace
    ? [0, size]
    : [
        0,
        ...Array.from({ length: CURL_STRIPS }, (_, i) => flat + ((size - flat) * i) / CURL_STRIPS),
        size,
      ];
  const strips = bounds.slice(0, -1).map((start, i) => {
    const end = bounds[i + 1] as number;
    const outer = i < bounds.length - 2;
    // toStart: the spine is at x=0; toEnd: at x=size (intervals mirrored).
    const a = toStart ? start : size - end;
    const b = toStart ? end : size - start;
    const ra = toStart ? a : a - (outer ? STRIP_OVERLAP_PX : 0);
    const rb = toStart ? b + (outer ? STRIP_OVERLAP_PX : 0) : b;
    const pivot = i === 0 ? hinge - srcPos : toStart ? a : b;
    return { ra, rb, pivot, bends: i > 0 };
  });

  const shade = (rect: SlotRect, keyframes: number[], times: number[]) => (
    <motion.div
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        pointerEvents: "none",
        background: "rgba(27,32,51,0.3)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: keyframes }}
      transition={{ duration: DURATION_S, times }}
    />
  );

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        perspective: 2000,
        perspectiveOrigin: horizontal
          ? `${hinge}px ${src.top + src.height / 2}px`
          : `${src.left + src.width / 2}px ${hinge}px`,
      }}
    >
      {under !== undefined && !inPlace && (
        <div
          style={{
            position: "absolute",
            left: dest.left,
            top: dest.top,
            width: dest.width,
            height: dest.height,
            display: "flex",
          }}
        >
          {under}
        </div>
      )}
      {/* The page being uncovered starts in the sheet's shadow; dest darkens as it lands. */}
      {shade(src, [0.55, 0.25, 0], [0, 0.5, 1])}
      {!inPlace && shade(dest, [0, 0, 0.35, 0], [0, 0.45, 0.85, 1])}
      <div
        style={{
          position: "absolute",
          left: src.left,
          top: src.top,
          width: src.width,
          height: src.height,
          transformStyle: "preserve-3d",
        }}
      >
        {strips.reduceRight<ReactNode>((inner, strip, i) => {
          const parentStart = i === 0 ? 0 : (strips[i - 1] as (typeof strips)[number]).ra;
          return (
            <motion.div
              key={strip.ra}
              style={segment(strip.ra - parentStart, strip.rb - strip.ra, strip.pivot - strip.ra)}
              initial={{ [rotate]: 0 }}
              animate={
                strip.bends
                  ? { [rotate]: [0, (sign * CURL_BEND_DEG) / CURL_STRIPS, 0] }
                  : { [rotate]: sign * TURN_DEG }
              }
              transition={
                strip.bends
                  ? { duration: DURATION_S, times: [0, 0.45, 1], ease: "easeInOut" }
                  : { duration: DURATION_S, ease: EASE }
              }
            >
              {face(front, -strip.ra, false)}
              {face(back, -(size - strip.rb), true)}
              {inner}
            </motion.div>
          );
        }, null)}
      </div>
    </div>
  );
}
