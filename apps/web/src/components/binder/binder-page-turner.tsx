"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VariantDisplay } from "../../lib/binders";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import type { PocketMetaMap } from "../seller-public/types";
import { BinderFaces, InsideCover, spreadSlots } from "./binder-faces";
import { FaceGrid, type PageSide } from "./face-grid";
import {
  measureTurnSlots,
  type OpeningAxis,
  PAGE_TURN_MS,
  PageTurn,
  type SlotRect,
  type TurnDirection,
  turnGeometry,
} from "./page-curl";
import type { PocketCopyMap } from "./pocket-copy-badge";
import { useCompactLayout } from "./use-compact-layout";

const TURN_CLEANUP_MS = PAGE_TURN_MS + 50;
// Horizontal distance a finger has to travel to turn a page on phones.
const SWIPE_THRESHOLD_PX = 50;
const DOTS_VISIBLE = 5;
const SLIDE_PX = 28;

const NAV_CSS = `
.sb-turner-link,
.sb-turner-off {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 180ms var(--ease-out-expo), border-color 180ms var(--ease-out-expo);
}
.sb-turner-link:hover,
.sb-turner-link:focus-visible {
  background: var(--surface-2);
  color: var(--ink);
}
.sb-turner-off {
  opacity: 0.45;
}
.sb-round-btn {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.sb-round-btn:disabled {
  opacity: 0.35;
}
.sb-round-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}
.sb-round-btn--primary:hover:not(:disabled) {
  background: var(--accent-strong);
}
@media (prefers-reduced-motion: reduce) {
  .sb-turner-link,
  .sb-turner-off {
    transition: none;
  }
}
`;

const CHEVRON_LEFT = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const CHEVRON_RIGHT = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

interface BinderPageTurnerProps {
  basePath: string;
  initialIndex: number;
  sheets: number;
  opening: OpeningAxis;
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Map<string, VariantDisplay>;
  sleeve: string;
  /** Seller mode only; absent keeps the collection look. */
  pocketMeta?: PocketMetaMap;
  /** Fase 7: language and grading chips of the copies linked to pockets, by pocket code. */
  pocketCopies?: PocketCopyMap;
  /** Fase 4: the viewer's wishlist variant ids; with canWish, cards get a "mis deseos" toggle. */
  wishlistVariantIds?: string[];
  canWish?: boolean;
}

export function BinderPageTurner({
  basePath,
  initialIndex,
  sheets,
  opening,
  format,
  pockets,
  panels,
  displays,
  sleeve,
  pocketMeta,
  pocketCopies,
  wishlistVariantIds,
  canWish,
}: BinderPageTurnerProps) {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const compact = useCompactLayout();
  const spreads = useMemo(() => generateSpreads(sheets), [sheets]);
  // Laptop steps by spread (two leaves at once). Phones step by face, in the
  // same order: faceIndex picks the face inside the current spread.
  const [index, setIndex] = useState(initialIndex);
  const [faceIndex, setFaceIndex] = useState(0);
  const [turn, setTurn] = useState<{ direction: TurnDirection; fromIndex: number } | null>(null);
  const [geometry, setGeometry] = useState<{ src: SlotRect; dest: SlotRect } | null>(null);
  const [slideDirection, setSlideDirection] = useState<TurnDirection>("forward");
  const cleanupRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (cleanupRef.current) {
        clearTimeout(cleanupRef.current);
      }
    },
    [],
  );

  const go = useCallback(
    (nextIndex: number, direction: TurnDirection) => {
      if (nextIndex < 0 || nextIndex >= spreads.length) {
        return;
      }
      router.replace(`${basePath}?spread=${nextIndex}`, { scroll: false });
      const fromIndex = index;
      setIndex(nextIndex);
      setFaceIndex(0);

      if (prefersReducedMotion) {
        return;
      }
      setTurn({ direction, fromIndex });
      if (cleanupRef.current) {
        clearTimeout(cleanupRef.current);
      }
      cleanupRef.current = setTimeout(() => setTurn(null), TURN_CLEANUP_MS);
    },
    [spreads.length, index, prefersReducedMotion, router, basePath],
  );

  // Phones: next/previous face, crossing into the neighbouring spread when needed.
  const stepFace = useCallback(
    (delta: 1 | -1) => {
      const direction: TurnDirection = delta > 0 ? "forward" : "backward";
      const current = spreads[index]?.faces.length ?? 1;
      const nextFace = faceIndex + delta;
      setSlideDirection(direction);
      if (nextFace >= 0 && nextFace < current) {
        setFaceIndex(nextFace);
        return;
      }
      const target = spreads[index + delta];
      if (!target) {
        return;
      }
      router.replace(`${basePath}?spread=${index + delta}`, { scroll: false });
      setIndex(index + delta);
      setFaceIndex(delta > 0 ? 0 : target.faces.length - 1);
    },
    [spreads, index, faceIndex, router, basePath],
  );

  // Warm the image cache for the neighbouring spreads so the sheet that turns
  // in already shows its cards.
  useEffect(() => {
    for (const neighbour of [spreads[index - 1], spreads[index + 1]]) {
      for (const face of neighbour?.faces ?? []) {
        for (let i = 1; i <= format.rows * format.cols; i++) {
          const content =
            pockets[formatPocketCode({ sheet: face.sheet, side: face.side, index: i })];
          const url =
            content?.kind === "card" ? displays.get(content.variant)?.imageUrl : undefined;
          if (url) {
            new Image().src = url;
          }
        }
      }
    }
  }, [spreads, index, format, pockets, displays]);

  // Measured after the new spread commits and before paint, so the sheet
  // starts and lands on the slots the faces actually occupy.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    setGeometry(turn && stage ? turnGeometry(measureTurnSlots(stage), turn.direction) : null);
  }, [turn]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        if (compact) {
          stepFace(1);
        } else {
          go(index + 1, "forward");
        }
      } else if (event.key === "ArrowLeft") {
        if (compact) {
          stepFace(-1);
        } else {
          go(index - 1, "backward");
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, stepFace, index, compact]);

  const spread = spreads[index];
  const outgoingSpread = turn ? spreads[turn.fromIndex] : null;

  if (!spread) {
    return null;
  }

  if (compact) {
    return (
      <PhonePages
        spreads={spreads}
        index={index}
        faceIndex={faceIndex}
        slideDirection={slideDirection}
        reducedMotion={prefersReducedMotion}
        onStep={stepFace}
        swipeStartX={swipeStartX}
        faces={{
          format,
          pockets,
          panels,
          displays,
          sleeve,
          pocketMeta,
          pocketCopies,
          wishlistVariantIds,
          canWish,
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{NAV_CSS}</style>
      <div ref={stageRef} style={{ position: "relative", width: "100%", isolation: "isolate" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <BinderFaces
            faces={spread.faces}
            format={format}
            pockets={pockets}
            panels={panels}
            displays={displays}
            sleeve={sleeve}
            opening={opening}
            pocketMeta={pocketMeta}
            pocketCopies={pocketCopies}
            wishlistVariantIds={wishlistVariantIds}
            canWish={canWish}
          />
        </div>
        {turn && outgoingSpread && geometry && (
          <PageTurn
            src={geometry.src}
            dest={geometry.dest}
            {...turnFaces(outgoingSpread.faces, spread.faces, turn.direction, (face, side) =>
              face ? (
                <FaceGrid
                  ghost
                  face={face}
                  format={format}
                  pockets={pockets}
                  panels={panels}
                  displays={displays}
                  sleeve={sleeve}
                  pocketMeta={pocketMeta}
                  pocketCopies={pocketCopies}
                  side={side}
                />
              ) : (
                <InsideCover format={format} />
              ),
            )}
          />
        )}
      </div>
      <nav
        className="sb-label"
        style={{
          marginTop: 20,
          display: "flex",
          gap: 14,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        {index > 0 ? (
          <a
            className="sb-turner-link"
            href={`${basePath}?spread=${index - 1}`}
            onClick={(event) => {
              event.preventDefault();
              go(index - 1, "backward");
            }}
          >
            &larr; Anterior
          </a>
        ) : (
          <span className="sb-turner-off" aria-disabled="true">
            &larr; Anterior
          </span>
        )}
        <span
          className="sb-data"
          style={{ fontSize: 13, fontWeight: 600, minWidth: 96, textAlign: "center" }}
        >
          Doble página {index + 1} / {spreads.length}
        </span>
        {index < spreads.length - 1 ? (
          <a
            className="sb-turner-link"
            href={`${basePath}?spread=${index + 1}`}
            onClick={(event) => {
              event.preventDefault();
              go(index + 1, "forward");
            }}
          >
            Siguiente &rarr;
          </a>
        ) : (
          <span className="sb-turner-off" aria-disabled="true">
            Siguiente &rarr;
          </span>
        )}
      </nav>
    </div>
  );
}

interface PhoneFaceProps {
  pocketCopies?: PocketCopyMap;
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Map<string, VariantDisplay>;
  sleeve: string;
  pocketMeta?: PocketMetaMap;
  wishlistVariantIds?: string[];
  canWish?: boolean;
}

/**
 * One page at a time (phones): the face with the spine and rings on its left
 * edge, swiped or stepped with the buttons. The motion is a short slide and
 * fade, no 3D curl; reduced motion only fades.
 */
function PhonePages({
  spreads,
  index,
  faceIndex,
  slideDirection,
  reducedMotion,
  onStep,
  swipeStartX,
  faces,
}: {
  spreads: { faces: SheetFace[] }[];
  index: number;
  faceIndex: number;
  slideDirection: TurnDirection;
  reducedMotion: boolean;
  onStep: (delta: 1 | -1) => void;
  swipeStartX: { current: number | null };
  faces: PhoneFaceProps;
}) {
  const offsets: number[] = [];
  let total = 0;
  for (const spread of spreads) {
    offsets.push(total);
    total += spread.faces.length;
  }
  const current = (offsets[index] ?? 0) + faceIndex;
  const face = spreads[index]?.faces[faceIndex];
  if (!face) {
    return null;
  }
  const windowStart = Math.max(0, Math.min(current - 2, total - DOTS_VISIBLE));
  const dots = Array.from({ length: Math.min(DOTS_VISIBLE, total) }, (_, i) => windowStart + i);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    swipeStartX.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStartX.current;
    swipeStartX.current = null;
    if (start === null) {
      return;
    }
    const dx = event.clientX - start;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
      onStep(dx < 0 ? 1 : -1);
    }
  }

  return (
    <div
      data-testid="binder-pages"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeStartX.current = null;
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        overflow: "hidden",
        touchAction: "pan-y",
        userSelect: "none",
      }}
    >
      <style>{NAV_CSS}</style>
      <motion.div
        key={`${index}-${faceIndex}`}
        style={{ width: "100%" }}
        initial={{
          opacity: 0,
          x: reducedMotion ? 0 : slideDirection === "forward" ? SLIDE_PX : -SLIDE_PX,
        }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reducedMotion ? 0.15 : 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <BinderFaces
          faces={[face]}
          single
          format={faces.format}
          pockets={faces.pockets}
          panels={faces.panels}
          displays={faces.displays}
          sleeve={faces.sleeve}
          pocketMeta={faces.pocketMeta}
          pocketCopies={faces.pocketCopies}
          wishlistVariantIds={faces.wishlistVariantIds}
          canWish={faces.canWish}
        />
      </motion.div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          maxWidth: 360,
          marginTop: 10,
        }}
      >
        <button
          type="button"
          className="sb-round-btn"
          aria-label="Página anterior"
          disabled={current === 0}
          onClick={() => onStep(-1)}
        >
          {CHEVRON_LEFT}
        </button>
        <div aria-hidden style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {dots.map((n) => (
            <span
              key={n}
              style={{
                display: "block",
                width: n === current ? 20 : 6,
                height: 6,
                borderRadius: 999,
                background: n === current ? "var(--accent)" : "#B9BFD0",
                transition: reducedMotion ? "none" : "width 200ms var(--ease-out-expo)",
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className="sb-round-btn sb-round-btn--primary"
          aria-label="Página siguiente"
          disabled={current >= total - 1}
          onClick={() => onStep(1)}
        >
          {CHEVRON_RIGHT}
        </button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
        Desliza para pasar de hoja
      </p>
    </div>
  );
}

// Forward turns sheet k+1: its front leaves slot 1 and its back lands on
// slot 0, over the old left face. Backward is the mirror image. Each side of
// the turning sheet carries the paper shading of the slot it sits over.
function turnFaces(
  outgoing: SheetFace[],
  incoming: SheetFace[],
  direction: TurnDirection,
  render: (face: SheetFace | null, side: PageSide) => ReactNode,
) {
  const [from, to] = direction === "forward" ? [1, 0] : [0, 1];
  const before = spreadSlots(outgoing);
  const after = spreadSlots(incoming);
  const sideOf = (slot: number): PageSide => (slot === 0 ? "left" : "right");
  return {
    front: render(before[from] ?? null, sideOf(from)),
    back: render(after[to] ?? null, sideOf(to)),
    under: render(before[to] ?? null, sideOf(to)),
  };
}
