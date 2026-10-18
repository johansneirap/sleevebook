"use client";

import {
  type AnimationPlaybackControls,
  animate,
  type MotionStyle,
  motion,
  useMotionValue,
} from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";

export interface ClosedBinderProps {
  name: string;
  coverColor: string;
  accentColor: string;
  coverImageUrl?: string | null;
  opening: "side" | "top";
  onOpen: () => void;
}

const FRONT_ANGLE = 0;
const SPINE_ANGLE = 90;
const BACK_ANGLE = 180;
const SWING_ANGLE = -160;
const KEY_STEP_DEG = 90;
const DRAG_DEG_PER_PX = 0.4;
const INERTIA_SECONDS = 0.35;
const SETTLE_SECONDS = 0.9;
const OPEN_ROTATE_SECONDS = 0.45;
const OPEN_SWING_SECONDS = 0.6;
const OPEN_DONE_MS = 1050;
const FADE_MS = 150;
const SERIF = "var(--font-display)";
const UI = "var(--font-ui)";

// Controls: quiet small-caps buttons for the views, one foil-hairline primary action.
const CONTROL_CSS = `
.sb-cover-quiet,
.sb-cover-open {
  font-family: var(--font-ui);
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  line-height: 1;
  transition:
    color 260ms var(--ease-out-expo),
    background-color 260ms var(--ease-out-expo),
    box-shadow 260ms var(--ease-out-expo);
}
.sb-cover-quiet {
  padding: 8px 10px;
  border: 0;
  background: none;
  color: var(--smoke);
  font-size: 12px;
}
.sb-cover-quiet:hover,
.sb-cover-quiet:focus-visible {
  color: var(--linen);
}
.sb-cover-open {
  padding: 13px 40px;
  border: 1px solid var(--foil);
  background: color-mix(in srgb, var(--velvet) 60%, transparent);
  color: var(--linen);
  font-size: 13px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--foil) 0%, transparent);
}
.sb-cover-open:hover:not(:disabled),
.sb-cover-open:focus-visible {
  color: var(--foil);
  background: color-mix(in srgb, var(--foil) 9%, transparent);
  box-shadow: 0 0 28px 0 color-mix(in srgb, var(--foil) 18%, transparent);
}
.sb-cover-open:disabled {
  opacity: 0.5;
}
@media (prefers-reduced-motion: reduce) {
  .sb-cover-quiet,
  .sb-cover-open {
    transition: none;
  }
}
`;

// Board width drives everything else: the cover is 0.82 w/h (3x3 binder),
// and the thickness is ~9% of the width. The stage also sets the perspective.
// Sized from the viewport height (leaving room for the header and the
// controls below) so the closed binder is the protagonist, like the open one.
const SIZE_VARS = {
  "--w": "max(200px, min(70vw, calc((100svh - 400px) * 0.82), 460px))",
  "--h": "calc(var(--w) / 0.82)",
  "--d": "calc(var(--w) * 0.09)",
} as CSSProperties;

const FACE: CSSProperties = {
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  overflow: "hidden",
};

const PAGE_EDGE: CSSProperties = {
  position: "absolute",
  backfaceVisibility: "hidden",
  background: "repeating-linear-gradient(90deg, #ece3cc 0 2px, #d9cdb1 2px 3px), #ece3cc",
  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
};

interface DragState {
  pointerId: number;
  startX: number;
  startRotation: number;
  lastX: number;
  lastTime: number;
  velocity: number; // deg per ms
}

type Phase = "idle" | "opening" | "fading";

function nearestEquivalent(current: number, target: number): number {
  return target + 360 * Math.round((current - target) / 360);
}

function leatherStyle(coverColor: string): CSSProperties {
  return {
    background: `radial-gradient(120% 80% at 18% 0%, rgba(255,255,255,0.10), transparent 60%), linear-gradient(160deg, rgba(255,255,255,0.03), rgba(0,0,0,0.28)), ${coverColor}`,
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)",
  };
}

export function ClosedBinder({
  name,
  coverColor,
  accentColor,
  coverImageUrl,
  opening,
  onOpen,
}: ClosedBinderProps) {
  const reduced = usePrefersReducedMotion();
  const rotation = useMotionValue(FRONT_ANGLE);
  const swing = useMotionValue(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const rotationControls = useRef<AnimationPlaybackControls | null>(null);
  const swingControls = useRef<AnimationPlaybackControls | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const drag = useRef<DragState | null>(null);
  const isSide = opening === "side";

  useEffect(() => {
    return () => {
      for (const timer of timers.current) {
        clearTimeout(timer);
      }
      rotationControls.current?.stop();
      swingControls.current?.stop();
    };
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  function animateRotation(target: number, seconds: number, velocity = 0) {
    rotationControls.current?.stop();
    if (reduced) {
      rotation.set(target);
      return;
    }
    rotationControls.current = animate(rotation, target, {
      type: "spring",
      bounce: 0,
      duration: seconds,
      velocity,
    });
  }

  function rotateTo(target: number) {
    animateRotation(nearestEquivalent(rotation.get(), target), SETTLE_SECONDS);
  }

  function rotateBy(delta: number) {
    animateRotation(rotation.get() + delta, SETTLE_SECONDS);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (phase !== "idle") {
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      rotateBy(KEY_STEP_DEG);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      rotateBy(-KEY_STEP_DEG);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (reduced || phase !== "idle") {
      return;
    }
    rotationControls.current?.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startRotation: rotation.get(),
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    rotation.set(current.startRotation + (event.clientX - current.startX) * DRAG_DEG_PER_PX);
    const now = performance.now();
    const elapsed = Math.max(now - current.lastTime, 1);
    current.velocity = ((event.clientX - current.lastX) * DRAG_DEG_PER_PX) / elapsed;
    current.lastX = event.clientX;
    current.lastTime = now;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // A pointer that stopped moving before release gives no inertia.
    const stale = performance.now() - current.lastTime > 80;
    const velocityPerSecond = stale ? 0 : current.velocity * 1000;
    const target = rotation.get() + velocityPerSecond * INERTIA_SECONDS;
    animateRotation(target, SETTLE_SECONDS, velocityPerSecond);
  }

  function handleOpen() {
    if (phase !== "idle") {
      return;
    }
    if (reduced) {
      setPhase("fading");
      later(onOpen, FADE_MS);
      return;
    }
    setPhase("opening");
    animateRotation(nearestEquivalent(rotation.get(), FRONT_ANGLE), OPEN_ROTATE_SECONDS);
    later(() => {
      swingControls.current = animate(swing, SWING_ANGLE, {
        duration: OPEN_SWING_SECONDS,
        ease: [0.22, 1, 0.36, 1],
      });
    }, OPEN_ROTATE_SECONDS * 1000);
    later(onOpen, OPEN_DONE_MS);
  }

  const stageStyle: CSSProperties = {
    ...SIZE_VARS,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "calc(var(--h) + 56px)",
    perspective: 1400,
    perspectiveOrigin: "50% 45%",
    touchAction: "pan-y",
    userSelect: "none",
    cursor: reduced ? "default" : "grab",
  };

  const frontSwing: MotionStyle = isSide
    ? { rotateY: swing, transformOrigin: "left center" }
    : { rotateX: swing, transformOrigin: "center top" };

  return (
    <div
      style={{
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      <div
        data-testid="closed-binder"
        role="application"
        aria-roledescription="binder 3D"
        aria-label={`Binder ${name}, cerrado`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the stage is a keyboard-operable 3D widget (arrow keys rotate it)
        tabIndex={0}
        style={stageStyle}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Spotlight: a soft pool of warm light behind the binder, like a vitrine lamp. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "46%",
            transform: "translate(-50%, -50%)",
            width: "calc(var(--w) * 2.1)",
            height: "calc(var(--h) * 1.2)",
            pointerEvents: "none",
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--foil) 16%, transparent), transparent 100%)",
          }}
        />
        {/* Floor shadow: soft contact shadow under the binder. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: 2,
            transform: "translateX(-50%)",
            width: "calc(var(--w) * 1.08)",
            height: 26,
            pointerEvents: "none",
            background: "radial-gradient(closest-side, rgba(0,0,0,0.7), transparent)",
          }}
        />
        <motion.div
          style={{
            position: "relative",
            width: "var(--w)",
            height: "var(--h)",
            transformStyle: "preserve-3d",
            rotateX: -6,
            rotateY: rotation,
          }}
        >
          {/* Back cover */}
          <div
            style={{
              ...FACE,
              ...leatherStyle(coverColor),
              borderRadius: "2px 6px 6px 2px",
              transform: "rotateY(180deg) translateZ(calc(var(--d) / 2))",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 12,
                border: `1px solid ${accentColor}`,
                opacity: 0.45,
              }}
            />
            <p
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                margin: 0,
                textAlign: "center",
                fontFamily: SERIF,
                fontVariant: "small-caps",
                letterSpacing: "0.2em",
                fontSize: 13,
                color: accentColor,
                opacity: 0.75,
              }}
            >
              Sleevebook
            </p>
          </div>

          {/* Page block: right edge, top and bottom */}
          <div
            aria-hidden
            style={{
              ...PAGE_EDGE,
              left: "calc(50% - var(--d) / 2)",
              top: "1.5%",
              width: "var(--d)",
              height: "97%",
              transform: "rotateY(90deg) translateZ(calc(var(--w) / 2 - 2px))",
            }}
          />
          <div
            aria-hidden
            style={{
              ...PAGE_EDGE,
              left: "2%",
              width: "96%",
              top: "calc(50% - var(--d) / 2)",
              height: "var(--d)",
              transform: "rotateX(90deg) translateZ(calc(var(--h) / 2 - 2px))",
            }}
          />
          <div
            aria-hidden
            style={{
              ...PAGE_EDGE,
              left: "2%",
              width: "96%",
              top: "calc(50% - var(--d) / 2)",
              height: "var(--d)",
              transform: "rotateX(-90deg) translateZ(calc(var(--h) / 2 - 2px))",
            }}
          />

          {/* Spine (left edge) */}
          <div
            data-testid="binder-spine"
            style={{
              ...FACE,
              ...leatherStyle(coverColor),
              left: "calc(50% - var(--d) / 2)",
              right: "auto",
              width: "var(--d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: "rotateY(-90deg) translateZ(calc(var(--w) / 2))",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 3,
                right: 3,
                top: 14,
                height: 1,
                background: accentColor,
                opacity: 0.7,
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 3,
                right: 3,
                bottom: 14,
                height: 1,
                background: accentColor,
                opacity: 0.7,
              }}
            />
            <span
              style={{
                writingMode: "vertical-rl",
                whiteSpace: "nowrap",
                fontFamily: SERIF,
                fontVariant: "small-caps",
                letterSpacing: "0.16em",
                fontSize: 12,
                color: accentColor,
              }}
            >
              {name}
            </span>
          </div>

          {/* Front cover: a container keeps it on the front plane, the inner
              panel swings on its hinge when the binder opens. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              transform: "translateZ(calc(var(--d) / 2))",
            }}
          >
            <motion.div
              data-testid="binder-front"
              style={{
                ...FACE,
                ...leatherStyle(coverColor),
                borderRadius: "6px 2px 2px 6px",
                ...frontSwing,
              }}
            >
              {coverImageUrl ? (
                // biome-ignore lint/performance/noImgElement: cover art is an arbitrary external URL
                <img
                  src={coverImageUrl}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : null}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 10,
                  border: `1px solid ${accentColor}`,
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: "28px 18px 26px",
                  textAlign: "center",
                  background: coverImageUrl
                    ? "linear-gradient(to top, rgba(0,0,0,0.78), transparent)"
                    : "transparent",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    color: accentColor,
                    textShadow: "0 1px 6px rgba(0,0,0,0.6)",
                  }}
                >
                  Binder
                </p>
                {/* Not a heading: the page already has an <h1> with the binder name. */}
                <p
                  style={{
                    margin: "6px 0 0",
                    fontFamily: SERIF,
                    fontWeight: 400,
                    fontVariant: "small-caps",
                    fontSize: "calc(var(--w) * 0.1)",
                    lineHeight: 1.15,
                    color: accentColor,
                    overflowWrap: "anywhere",
                    textShadow: "0 1px 6px rgba(0,0,0,0.6)",
                  }}
                >
                  {name}
                </p>
                <div
                  aria-hidden
                  style={{
                    width: 40,
                    height: 1,
                    margin: "10px auto 0",
                    background: accentColor,
                  }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <style>{CONTROL_CSS}</style>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          justifyContent: "center",
          marginTop: 14,
        }}
      >
        <button type="button" className="sb-cover-quiet" onClick={() => rotateTo(FRONT_ANGLE)}>
          Ver tapa
        </button>
        <button type="button" className="sb-cover-quiet" onClick={() => rotateTo(SPINE_ANGLE)}>
          Ver lomo
        </button>
        <button type="button" className="sb-cover-quiet" onClick={() => rotateTo(BACK_ANGLE)}>
          Ver contratapa
        </button>
      </div>
      <p
        style={{
          textAlign: "center",
          fontFamily: UI,
          fontSize: 12,
          color: "var(--smoke)",
          margin: "10px 0 0",
        }}
      >
        {reduced ? "Usa los botones para girar" : "Arrastra o usa ← → para girar"}
      </p>
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button
          type="button"
          className="sb-cover-open"
          onClick={handleOpen}
          disabled={phase !== "idle"}
          style={{ cursor: phase === "idle" ? "pointer" : "default" }}
        >
          Abrir binder
        </button>
      </div>
    </div>
  );
}
