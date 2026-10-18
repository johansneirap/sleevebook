"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { formatPocketCode, generateSpreads } from "@sleevebook/binder-core";
import { useRouter } from "next/navigation";
import {
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
import { FaceGrid } from "./face-grid";
import {
  measureTurnSlots,
  type OpeningAxis,
  PAGE_TURN_MS,
  PageTurn,
  type SlotRect,
  type TurnDirection,
  turnGeometry,
} from "./page-curl";

const TURN_CLEANUP_MS = PAGE_TURN_MS + 50;

// Navigation lives at the edges and stays quiet: foil only on hover/focus.
const NAV_CSS = `
.sb-turner-link {
  color: var(--smoke);
  text-decoration: none;
  padding-bottom: 2px;
  background: linear-gradient(90deg, var(--foil), var(--foil)) left bottom / 0 1px no-repeat;
  transition: color 240ms var(--ease-out-expo), background-size 280ms var(--ease-out-expo);
}
.sb-turner-link:hover,
.sb-turner-link:focus-visible {
  color: var(--foil);
  background-size: 100% 1px;
}
.sb-turner-link:focus-visible {
  outline: 1px solid var(--foil);
  outline-offset: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .sb-turner-link {
    transition: color 200ms linear;
  }
}
`;

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
  wishlistVariantIds,
  canWish,
}: BinderPageTurnerProps) {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const spreads = useMemo(() => generateSpreads(sheets), [sheets]);
  const [index, setIndex] = useState(initialIndex);
  const [turn, setTurn] = useState<{ direction: TurnDirection; fromIndex: number } | null>(null);
  const [geometry, setGeometry] = useState<{ src: SlotRect; dest: SlotRect } | null>(null);
  const cleanupRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stageRef = useRef<HTMLDivElement>(null);

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
        go(index + 1, "forward");
      } else if (event.key === "ArrowLeft") {
        go(index - 1, "backward");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, index]);

  const spread = spreads[index];
  const outgoingSpread = turn ? spreads[turn.fromIndex] : null;

  if (!spread) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{NAV_CSS}</style>
      <div ref={stageRef} style={{ position: "relative", width: "100%", isolation: "isolate" }}>
        {/* Vitrine spotlight: a soft halo of light behind the open binder. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-10%",
            bottom: "-10%",
            left: 0,
            right: 0,
            zIndex: -1,
            pointerEvents: "none",
            background:
              "radial-gradient(closest-side, rgba(255, 236, 200, 0.2), rgba(255, 236, 200, 0.05) 55%, transparent 100%)",
          }}
        />
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
            wishlistVariantIds={wishlistVariantIds}
            canWish={canWish}
          />
        </div>
        {turn && outgoingSpread && geometry && (
          <PageTurn
            src={geometry.src}
            dest={geometry.dest}
            {...turnFaces(outgoingSpread.faces, spread.faces, turn.direction, (face) =>
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
          marginTop: 22,
          display: "flex",
          gap: 20,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--smoke)",
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
          <span style={{ opacity: 0.35 }}>&larr; Anterior</span>
        )}
        <span className="sb-data" style={{ fontSize: 11, letterSpacing: "0.08em" }}>
          Spread {index + 1} / {spreads.length}
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
          <span style={{ opacity: 0.35 }}>Siguiente &rarr;</span>
        )}
      </nav>
    </div>
  );
}

// Forward turns sheet k+1: its front leaves slot 1 and its back lands on
// slot 0, over the old left face. Backward is the mirror image.
function turnFaces(
  outgoing: SheetFace[],
  incoming: SheetFace[],
  direction: TurnDirection,
  render: (face: SheetFace | null) => ReactNode,
) {
  const [from, to] = direction === "forward" ? [1, 0] : [0, 1];
  const before = spreadSlots(outgoing);
  const after = spreadSlots(incoming);
  return {
    front: render(before[from] ?? null),
    back: render(after[to] ?? null),
    under: render(before[to] ?? null),
  };
}
