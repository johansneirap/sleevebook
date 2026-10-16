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

const HERO: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: "clamp(28px, 5vw, 64px)",
  alignItems: "center",
  padding: "clamp(40px, 8vh, 96px) clamp(16px, 5vw, 56px)",
  background:
    "radial-gradient(70% 60% at 68% 42%, color-mix(in srgb, var(--foil) 13%, transparent), transparent 70%), radial-gradient(120% 90% at 50% 0%, var(--leather) 0%, var(--velvet) 75%)",
};

const WORDMARK: CSSProperties = {
  margin: "0 0 clamp(40px, 9vh, 88px)",
  fontSize: 26,
  color: "var(--linen)",
};

const EYEBROW: CSSProperties = {
  margin: "0 0 20px",
  color: "var(--smoke)",
  fontSize: 12,
};

const TITLE: CSSProperties = {
  margin: 0,
  fontSize: "clamp(40px, 6vw, 72px)",
  lineHeight: 1.02,
  color: "var(--linen)",
  maxWidth: "14ch",
};

const CTA_BASE: CSSProperties = {
  display: "inline-block",
  padding: "12px 22px",
  borderRadius: 2,
  fontSize: 13,
  textDecoration: "none",
};

const PRIMARY: CSSProperties = {
  ...CTA_BASE,
  background: "var(--foil)",
  color: "var(--velvet)",
  border: "1px solid var(--foil)",
};

const SECONDARY: CSSProperties = {
  ...CTA_BASE,
  color: "var(--linen)",
  border: "1px solid var(--rule)",
};

const SPREAD_FRAME: CSSProperties = {
  display: "flex",
  position: "relative",
  padding: "clamp(8px, 2.4vw, 16px)",
  borderRadius: 6,
  background: "var(--leather)",
  boxShadow:
    "0 40px 70px -30px rgba(0,0,0,0.85), inset 0 0 0 1px color-mix(in srgb, var(--foil) 18%, transparent)",
};

const FACE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
  gap: "clamp(4px, 1.4vw, 9px)",
  alignContent: "center",
  padding: "clamp(8px, 2.4vw, 18px)",
  background: "var(--leather-deep)",
};

const GUTTER: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "50%",
  width: 28,
  transform: "translateX(-50%)",
  pointerEvents: "none",
  background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.6) 50%, transparent)",
};

const POCKET: CSSProperties = {
  position: "relative",
  aspectRatio: "63 / 88",
  overflow: "hidden",
  borderRadius: 2,
  background: "rgba(0,0,0,0.35)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
};

const IMG: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const GLARE: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.14) 45%, rgba(255,255,255,0) 60%)",
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
    <div style={SPREAD_FRAME}>
      <FaceGrid cells={spread[0]} turnSlot={0} />
      <span aria-hidden style={GUTTER} />
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
        <p className="sb-display" style={WORDMARK}>
          Sleevebook
        </p>
        <p className="sb-label" style={EYEBROW}>
          Colección privada
        </p>
        <h1 id="landing-title" className="sb-display" style={TITLE}>
          Tu colección, presentada como en una vitrina.
        </h1>
        <p
          style={{
            margin: "20px 0 32px",
            color: "var(--smoke)",
            maxWidth: "36ch",
            lineHeight: 1.6,
          }}
        >
          Cada carta en su funda, cada binder como una pieza de catálogo.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href="/binders" className="sb-label" style={PRIMARY}>
            Mis binders
          </Link>
          <Link href="/demo" className="sb-label" style={SECONDARY}>
            Ver demo
          </Link>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
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
          style={{ margin: "14px 0 0", textAlign: "right", color: "var(--smoke)", fontSize: 12 }}
        >
          Hoja {counter}
        </p>
      </div>
    </section>
  );
}
