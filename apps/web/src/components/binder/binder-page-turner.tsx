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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{NAV_CSS}</style>
      <div style={{ position: "relative", width: "100%", isolation: "isolate" }}>
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
          />
        </div>
        {turn && outgoingSpread && (
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, pointerEvents: "none", perspective: 1800 }}
          >
            <PageCurl opening={opening} direction={turn.direction}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <BinderFaces
                  faces={outgoingSpread.faces}
                  format={format}
                  pockets={pockets}
                  panels={panels}
                  displays={displays}
                  sleeve={sleeve}
                  opening={opening}
                />
              </div>
            </PageCurl>
          </div>
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
