"use client";

import type { Format, Layout } from "@sleevebook/binder-core";
import { generateSpreads } from "@sleevebook/binder-core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import { BinderFaces } from "./binder-faces";
import { type OpeningAxis, PageCurl, type TurnDirection } from "./page-curl";

const TURN_CLEANUP_MS = 750;

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
}: BinderPageTurnerProps) {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const spreads = useMemo(() => generateSpreads(sheets), [sheets]);
  const [index, setIndex] = useState(initialIndex);
  const [turn, setTurn] = useState<{ direction: TurnDirection; fromIndex: number } | null>(null);
  const cleanupRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    <div>
      <div style={{ position: "relative" }}>
        <BinderFaces
          faces={spread.faces}
          format={format}
          pockets={pockets}
          panels={panels}
          displays={displays}
          sleeve={sleeve}
        />
        {turn && outgoingSpread && (
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, pointerEvents: "none", perspective: 1800 }}
          >
            <PageCurl opening={opening} direction={turn.direction}>
              <BinderFaces
                faces={outgoingSpread.faces}
                format={format}
                pockets={pockets}
                panels={panels}
                displays={displays}
                sleeve={sleeve}
              />
            </PageCurl>
          </div>
        )}
      </div>
      <nav style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
        {index > 0 ? (
          <a
            href={`${basePath}?spread=${index - 1}`}
            onClick={(event) => {
              event.preventDefault();
              go(index - 1, "backward");
            }}
          >
            &larr; Anterior
          </a>
        ) : (
          <span style={{ color: "#aaa" }}>&larr; Anterior</span>
        )}
        <span>
          Spread {index + 1} / {spreads.length}
        </span>
        {index < spreads.length - 1 ? (
          <a
            href={`${basePath}?spread=${index + 1}`}
            onClick={(event) => {
              event.preventDefault();
              go(index + 1, "forward");
            }}
          >
            Siguiente &rarr;
          </a>
        ) : (
          <span style={{ color: "#aaa" }}>Siguiente &rarr;</span>
        )}
      </nav>
    </div>
  );
}
