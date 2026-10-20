"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import { demoImageUrls } from "../../sample-layout";
import {
  measureTurnSlots,
  PAGE_TURN_MS,
  PageTurn,
  type SlotRect,
  turnGeometry,
} from "../binder/page-curl";

const TURN_INTERVAL_MS = 4000;
const TURN_DURATION_MS = PAGE_TURN_MS + 50;
const ROWS = 3;
const COLS = 3;

const IMAGES = Object.values(demoImageUrls);

type Face = Array<string | null>;
type Spread = [Face, Face];

// Deterministic on purpose: the prerendered HTML must match the first client render.
function buildFace(seed: number): Face {
  return Array.from({ length: ROWS * COLS }, (_, i) => {
    if ((i + seed) % 5 === 4) {
      return null;
    }
    return IMAGES[(i * 3 + seed) % IMAGES.length] ?? null;
  });
}

const SPREADS: Spread[] = [0, 1, 2, 3].map((seed) => [buildFace(seed), buildFace(seed + 7)]);

function spreadAt(index: number): Spread {
  const fallback: Spread = [buildFace(0), buildFace(7)];
  return SPREADS[index % SPREADS.length] ?? fallback;
}

// Hero: copy on the left, the real binder object on a light desk on the right.
const HERO: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: "clamp(32px, 5vw, 64px)",
  alignItems: "center",
  padding: "clamp(32px, 6vh, 72px) clamp(20px, 5vw, 56px)",
  maxWidth: 1320,
  margin: "0 auto",
  boxSizing: "border-box",
};

const DESK: CSSProperties = {
  position: "relative",
  padding: "clamp(20px, 4vw, 44px)",
  borderRadius: 28,
  background: "radial-gradient(70% 70% at 50% 40%, #ffffff 0%, rgba(255,255,255,0) 72%), var(--bg)",
  border: "1px solid var(--line)",
};

const TITLE: CSSProperties = {
  margin: 0,
  fontSize: "clamp(30px, 4.6vw, 48px)",
  lineHeight: 1.12,
  letterSpacing: "-0.02em",
  color: "var(--ink)",
  maxWidth: "16ch",
};

const PRIMARY: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "0 22px",
  borderRadius: 14,
  background: "var(--accent)",
  border: "1px solid var(--accent)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  textDecoration: "none",
};

const SECONDARY: CSSProperties = {
  ...PRIMARY,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
};

const GHOST: CSSProperties = {
  ...PRIMARY,
  padding: "0 4px",
  background: "transparent",
  border: "1px solid transparent",
  color: "var(--accent)",
};

// The binder object: blue cover with a margin around the pages, dashed
// stitching, paper inside, metal rings at the spine.
const BINDER: CSSProperties = {
  position: "relative",
  display: "flex",
  padding: "clamp(12px, 2.6vw, 20px)",
  borderRadius: "14px 18px 18px 14px",
  background:
    "radial-gradient(120% 80% at 18% 0%, rgba(255,255,255,0.14), transparent 60%), linear-gradient(160deg, rgba(255,255,255,0.05), rgba(0,0,0,0.25)), var(--binder-cover)",
  boxShadow:
    "0 36px 56px -26px rgba(27,32,51,0.5), 0 4px 10px rgba(27,32,51,0.12), inset 0 0 0 1px rgba(0,0,0,0.18)",
};

const STITCH: CSSProperties = {
  position: "absolute",
  inset: "clamp(5px, 1vw, 8px)",
  border: "1.5px dashed rgba(255,255,255,0.3)",
  borderRadius: 10,
  pointerEvents: "none",
};

const FACE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
  gap: "clamp(4px, 1.4vw, 9px)",
  alignContent: "center",
  padding: "clamp(8px, 2.4vw, 16px)",
  borderRadius: 4,
  background:
    "linear-gradient(90deg, #f1f1ea 0%, var(--binder-paper) 14%, var(--binder-paper) 86%, #f1f1ea 100%)",
  boxShadow: "inset 0 0 0 1px var(--binder-paper-edge)",
};

const GUTTER: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "50%",
  width: 22,
  transform: "translateX(-50%)",
  pointerEvents: "none",
  background: "linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.28) 50%, rgba(0,0,0,0))",
};

const RING_COLUMN: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "50%",
  width: 14,
  transform: "translateX(-50%)",
  pointerEvents: "none",
};

const RING: CSSProperties = {
  position: "absolute",
  left: "50%",
  width: 14,
  height: 14,
  transform: "translate(-50%, -50%)",
  borderRadius: "50%",
  background: "radial-gradient(circle at 35% 35%, #ffffff 0%, #c4c9d4 42%, #6d7485 100%)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
};

const POCKET: CSSProperties = {
  position: "relative",
  aspectRatio: "63 / 88",
  overflow: "hidden",
  borderRadius: 4,
  background: "rgba(27,32,51,0.05)",
  boxShadow: "inset 0 0 0 1px rgba(27,32,51,0.08)",
};

const IMG: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

// Sleeve: a clear plastic layer with a diagonal specular reflection.
const GLARE: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.32) 45%, rgba(255,255,255,0) 60%)",
};

function Pocket({ url }: { url: string | null }) {
  return (
    <div style={POCKET}>
      {url ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: static landing with demo images, no next/image optimization needed */}
          <img src={url} alt="" draggable={false} style={IMG} />
          <span style={GLARE} />
        </>
      ) : null}
    </div>
  );
}

function FaceGrid({ cells, turnSlot }: { cells: Face; turnSlot?: number }) {
  return (
    <div style={FACE} data-turn-slot={turnSlot}>
      {cells.map((url, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3x3 grid, position is the identity
        <Pocket key={i} url={url} />
      ))}
    </div>
  );
}

function SpreadView({ spread }: { spread: Spread }) {
  return (
    <div style={BINDER}>
      <span aria-hidden style={STITCH} />
      <FaceGrid cells={spread[0]} turnSlot={0} />
      <span aria-hidden style={GUTTER} />
      <span aria-hidden style={RING_COLUMN}>
        {[18, 50, 82].map((top) => (
          <span key={top} style={{ ...RING, top: `${top}%` }} />
        ))}
      </span>
      <FaceGrid cells={spread[1]} turnSlot={1} />
    </div>
  );
}

export function LandingHero() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [turn, setTurn] = useState<{ index: number; from: number | null }>({
    index: 0,
    from: null,
  });

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{ src: SlotRect; dest: SlotRect } | null>(null);
  const autoTurn = !prefersReducedMotion && !hidden;

  useEffect(() => {
    if (!autoTurn) {
      return;
    }
    const id = window.setInterval(() => {
      setTurn((prev) => ({ index: (prev.index + 1) % SPREADS.length, from: prev.index }));
    }, TURN_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoTurn]);

  useEffect(() => {
    if (turn.from === null) {
      return;
    }
    const id = window.setTimeout(
      () => setTurn((prev) => ({ ...prev, from: null })),
      TURN_DURATION_MS,
    );
    return () => window.clearTimeout(id);
  }, [turn]);

  // Measured before paint so the sheet lifts off the right face and lands on the left one.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    setGeometry(
      turn.from !== null && stage ? turnGeometry(measureTurnSlots(stage), "forward") : null,
    );
  }, [turn]);

  const spread = spreadAt(turn.index);
  const outgoing = turn.from === null ? null : spreadAt(turn.from);
  const counter = `${String(turn.index + 1).padStart(2, "0")} / ${String(SPREADS.length).padStart(2, "0")}`;

  return (
    <section data-testid="landing-hero" aria-labelledby="landing-title" style={HERO}>
      <div>
        <p
          className="sb-label"
          style={{ margin: "0 0 14px", color: "var(--accent)", fontSize: 14, fontWeight: 700 }}
        >
          Para jugadores y coleccionistas de cartas
        </p>
        <h1 id="landing-title" className="sb-display" style={TITLE}>
          Tu colección, ordenada como en un binder de verdad.
        </h1>
        <p
          style={{
            margin: "18px 0 28px",
            color: "var(--muted)",
            maxWidth: "42ch",
            fontSize: 17,
            lineHeight: 1.6,
          }}
        >
          Catalogá tus cartas, mirá qué te falta para completar un set y compartí tu binder con un
          link.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href="/binders" style={PRIMARY}>
            Mis binders
          </Link>
          <Link href="/demo" style={SECONDARY}>
            Ver demo
          </Link>
          <Link href="/galeria" style={GHOST}>
            Explorar la galería
          </Link>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={DESK}>
          <div ref={stageRef} style={{ position: "relative" }}>
            <SpreadView spread={spread} />
            {outgoing && geometry ? (
              <PageTurn
                src={geometry.src}
                dest={geometry.dest}
                front={<FaceGrid cells={outgoing[1]} />}
                back={<FaceGrid cells={spread[0]} />}
                under={<FaceGrid cells={outgoing[0]} />}
              />
            ) : null}
          </div>
          <p
            aria-hidden
            className="sb-data"
            style={{
              margin: "16px 0 0",
              textAlign: "right",
              color: "var(--muted)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Hoja {counter}
          </p>
        </div>
      </div>
    </section>
  );
}
