"use client";

import { conditionLabel, defaultFoilMask, languageLabel } from "@sleevebook/binder-core";
import { motion } from "motion/react";
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import { HoloGl } from "../card-render/holo-gl";
import { type PocketMeta, STATUS_LABELS } from "../seller-public/types";
import { useWantList } from "../seller-public/want-list";
import { CardBack } from "./card-back";
import { FlipCard } from "./flip-card";
import type { PocketCopy } from "./pocket-copy-badge";

const CARD_ASPECT_RATIO = 88 / 63;
const CARD_MAX_WIDTH = 340;
const CARD_MIN_WIDTH = 160;
/** From this viewport width up, the data card sits beside the card. */
const SIDE_PANEL_MIN_VIEWPORT = 1000;
const SIDE_PANEL_WIDTH = 280;
const SIDE_PANEL_GAP = 48;
const DESKTOP_VERTICAL_MARGIN = 72;
const EDGE = 16;
/** Height kept free under the card on phones for the bottom sheet. */
const PHONE_PANEL_RESERVE = 260;
/** Phones: room kept above the card for the close button. */
const PHONE_TOP_RESERVE = 68;
const PHONE_CARD_MIN_WIDTH = 120;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function viewportSize(): { width: number; height: number } {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
}

/**
 * Width of the enlarged card for a given viewport. The card is always centered
 * in the viewport, so the FLIP origin math only needs this value and the
 * viewport size; measureFocusOrigin and the overlay both call this function.
 */
export function focusCardWidth(viewportWidth: number, viewportHeight: number): number {
  if (viewportWidth >= SIDE_PANEL_MIN_VIEWPORT) {
    const byHeight = Math.floor((viewportHeight - 2 * DESKTOP_VERTICAL_MARGIN) / CARD_ASPECT_RATIO);
    return clamp(byHeight, CARD_MIN_WIDTH, CARD_MAX_WIDTH);
  }
  const byWidth = viewportWidth - 2 * EDGE;
  // The card's bottom edge must clear the sheet pinned to the bottom.
  const byHeight = Math.floor(
    (viewportHeight - 2 * (PHONE_PANEL_RESERVE + EDGE)) / CARD_ASPECT_RATIO,
  );
  return clamp(Math.min(byWidth, byHeight), CARD_MIN_WIDTH, CARD_MAX_WIDTH);
}

/** Offset and scale that map the enlarged card onto a pocket's on-screen rect. */
export interface FocusOrigin {
  x: number;
  y: number;
  scale: number;
}

/**
 * Measures where a pocket sits relative to the viewport center, so the enlarged
 * card (centered by the overlay) can start exactly on top of the pocket.
 */
export function measureFocusOrigin(rect: DOMRect): FocusOrigin {
  const { width: viewportWidth, height: viewportHeight } = viewportSize();
  const cardWidth = focusCardWidth(viewportWidth, viewportHeight);
  return {
    x: rect.left + rect.width / 2 - viewportWidth / 2,
    y: rect.top + rect.height / 2 - viewportHeight / 2,
    scale: rect.width / cardWidth,
  };
}

const SPRING = { type: "spring", duration: 0.6, bounce: 0 } as const;
const BACKDROP_FADE = { duration: 0.5, ease: "easeOut" } as const;
const REDUCED_FADE = { duration: 0.15, ease: "easeOut" } as const;

// Dark scrim so the card pops; the light panel sits on top of it.
const BACKDROP_BACKGROUND = "rgba(17, 20, 32, 0.72)";

const ACTION_CSS = `
.cfo-btn { transition: background-color 180ms var(--ease-out-expo), color 180ms var(--ease-out-expo), border-color 180ms var(--ease-out-expo); }
.cfo-btn:disabled { cursor: default; }
.cfo-secondary { background: var(--surface); color: var(--ink); border: 1px solid var(--line); }
.cfo-secondary:hover { background: var(--surface-2); }
.cfo-secondary[aria-pressed="true"] { background: var(--surface-2); border-color: var(--muted); }
.cfo-outline { background: var(--surface); color: var(--accent); border: 1px solid var(--accent); }
.cfo-outline:hover { background: var(--accent-soft); }
.cfo-outline[aria-pressed="true"] { background: var(--accent); color: #fff; }
.cfo-outline[aria-pressed="true"]:hover { background: var(--accent-strong); }
.cfo-primary { background: var(--accent); color: #fff; border: 1px solid var(--accent); }
.cfo-primary:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
.cfo-quiet { background: var(--surface); color: var(--ink); border: 1px solid var(--line); }
.cfo-quiet:hover { background: var(--surface-2); }
.cfo-disabled:disabled { background: var(--surface-2); color: var(--muted); border: 1px solid var(--line); }
.cfo-close { transition: background-color 180ms var(--ease-out-expo); }
.cfo-close:hover { background: var(--surface-2); }
`;

const ACTION_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxSizing: "border-box",
  whiteSpace: "nowrap",
  flex: "1 1 auto",
};

const CHIP_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
  minHeight: 28,
  padding: "4px 10px",
  borderRadius: 999,
  background: "var(--surface-2)",
  margin: 0,
};

const CHIP_LABEL: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 600,
};
const CHIP_VALUE: CSSProperties = { margin: 0, color: "var(--ink)", fontSize: 13, fontWeight: 600 };

const STATUS_CHIP_COLORS: Record<string, CSSProperties> = {
  disponible: { color: "var(--success)", background: "var(--success-soft)" },
  reservado: { color: "var(--warning)", background: "var(--warning-soft)" },
  vendido: { color: "var(--danger)", background: "var(--danger-soft)" },
};

// Seller mode: adds the focused card to the buyer's list. Vendido cannot be added.
function WantListToggle({
  inList,
  sold,
  onToggle,
}: {
  inList: boolean;
  sold: boolean;
  onToggle: () => void;
}) {
  const label = sold ? "Carta vendida" : inList ? "Quitar de mi lista" : "Agregar a mi lista";
  const variant = sold ? "cfo-disabled" : inList ? "cfo-quiet" : "cfo-primary";
  return (
    <button
      type="button"
      className={`cfo-btn ${variant}`}
      disabled={sold}
      onClick={onToggle}
      style={ACTION_BASE}
    >
      {label}
    </button>
  );
}

// Fase 4: the viewer's own wishlist ("mis deseos"). Accent outline, filled
// when the card is already on the list.
function WishlistToggle({ inList, onToggle }: { inList: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="cfo-btn cfo-outline"
      aria-pressed={inList}
      onClick={onToggle}
      style={ACTION_BASE}
    >
      {inList ? "En mis deseos" : "Agregar a mis deseos"}
    </button>
  );
}

export function CardFocusOverlay({
  display,
  sleeve,
  origin,
  onClose,
  pocketCode,
  pocketMeta,
  copy,
  wish,
}: {
  display: VariantDisplay;
  sleeve: string;
  origin: FocusOrigin;
  onClose: () => void;
  /** Seller mode only: the focused pocket and its price/status. */
  pocketCode?: string;
  pocketMeta?: PocketMeta;
  /** Fase 7: the physical copy linked to this pocket, if any. */
  copy?: PocketCopy;
  /** Signed-in viewers only: toggles the card on their wishlist. */
  wish?: { inList: boolean; onToggle: () => void };
}) {
  const reducedMotion = usePrefersReducedMotion();
  const want = useWantList();
  const [flipped, setFlipped] = useState(false);
  // Measured once on mount: the same viewport the origin was measured in.
  const [layout] = useState(() => {
    const { width: viewportWidth, height: viewportHeight } = viewportSize();
    return {
      cardWidth: focusCardWidth(viewportWidth, viewportHeight),
      sidePanel: viewportWidth >= SIDE_PANEL_MIN_VIEWPORT,
    };
  });
  const { sidePanel } = layout;

  // Phones: the bottom sheet's height depends on its content, so it is
  // measured before the first paint and the card is fitted into the space
  // above it (never under it). The FLIP origin is re-aimed at that spot.
  const sheetRef = useRef<HTMLElement>(null);
  const [phoneFit, setPhoneFit] = useState<{
    cardWidth: number;
    origin: FocusOrigin;
    top: number;
    height: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (sidePanel || !sheetRef.current) return;
    const { width: viewportWidth, height: viewportHeight } = viewportSize();
    const sheetHeight = sheetRef.current.getBoundingClientRect().height;
    const height = Math.max(0, viewportHeight - sheetHeight - PHONE_TOP_RESERVE - EDGE);
    const fitted = clamp(
      Math.min(viewportWidth - 2 * EDGE, Math.floor(height / CARD_ASPECT_RATIO)),
      PHONE_CARD_MIN_WIDTH,
      CARD_MAX_WIDTH,
    );
    const pocketWidth = origin.scale * layout.cardWidth;
    const centerShift = PHONE_TOP_RESERVE + height / 2 - viewportHeight / 2;
    setPhoneFit({
      cardWidth: fitted,
      origin: { x: origin.x, y: origin.y - centerShift, scale: pocketWidth / fitted },
      top: PHONE_TOP_RESERVE,
      height,
    });
  }, [sidePanel, origin, layout.cardWidth]);
  const cardWidth = phoneFit?.cardWidth ?? layout.cardWidth;
  const cardOrigin = phoneFit?.origin ?? origin;
  const showCard = sidePanel || phoneFit !== null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (
        (event.key === "f" || event.key === "F") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        setFlipped((value) => !value);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const caption = `${display.setName} — ${display.name} ${display.number} (${display.variant})`;

  // The overlay is unmounted by AnimatePresence in BinderFaces; the exit
  // animations of its descendants run first, so the card shrinks back into
  // its pocket before the overlay disappears.
  const cardMotion = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: REDUCED_FADE,
      }
    : {
        initial: { x: cardOrigin.x, y: cardOrigin.y, scale: cardOrigin.scale, opacity: 1 },
        animate: { x: 0, y: 0, scale: 1, opacity: 1 },
        exit: { x: cardOrigin.x, y: cardOrigin.y, scale: cardOrigin.scale, opacity: 1 },
        transition: SPRING,
      };

  // Laptop: a white card hangs off the right edge of the centered card, so the
  // card itself never moves off-center. Phone: a bottom sheet.
  const panelPlacement: CSSProperties = sidePanel
    ? {
        left: `calc(50% + ${cardWidth / 2 + SIDE_PANEL_GAP}px)`,
        top: "50%",
        width: SIDE_PANEL_WIDTH,
        transform: "translateY(-50%)",
        padding: 20,
        borderRadius: "var(--radius-lg)",
      }
    : {
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: "55vh",
        overflowY: "auto",
        padding: "10px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
        borderRadius: "20px 20px 0 0",
      };

  const flipButton = (
    <button
      type="button"
      className="cfo-btn cfo-secondary"
      aria-pressed={flipped}
      onClick={() => setFlipped((value) => !value)}
      style={ACTION_BASE}
    >
      Voltear carta
    </button>
  );

  const status = pocketMeta?.status;
  const statusColors = status ? STATUS_CHIP_COLORS[status] : undefined;
  const titleSize = sidePanel ? 22 : 20;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      style={{ position: "fixed", inset: 0, zIndex: 50 }}
    >
      <style>{ACTION_CSS}</style>
      <motion.button
        type="button"
        aria-label="Cerrar vista de carta"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reducedMotion ? REDUCED_FADE : BACKDROP_FADE}
        style={{
          position: "absolute",
          inset: 0,
          background: BACKDROP_BACKGROUND,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "absolute",
          ...(phoneFit
            ? { left: 0, right: 0, top: phoneFit.top, height: phoneFit.height }
            : { inset: 0 }),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {showCard && (
          <motion.div
            data-testid="focused-card"
            initial={cardMotion.initial}
            animate={cardMotion.animate}
            exit={cardMotion.exit}
            transition={cardMotion.transition}
            style={{ width: cardWidth, pointerEvents: "auto", willChange: "transform" }}
          >
            <FlipCard
              flipped={flipped}
              width={cardWidth}
              front={
                <HoloGl
                  imageUrl={display.imageUrl}
                  name={display.name}
                  variant={display.variant}
                  mask={display.foilMask ?? defaultFoilMask(display.variant)}
                  sleeve={sleeve}
                  width={cardWidth}
                />
              }
              back={<CardBack width={cardWidth} />}
            />
          </motion.div>
        )}
      </div>
      <motion.section
        ref={sheetRef}
        aria-label="Datos de catálogo"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reducedMotion ? REDUCED_FADE : BACKDROP_FADE}
        style={{
          position: "absolute",
          ...PANEL_BASE_STYLE,
          ...panelPlacement,
        }}
      >
        {!sidePanel ? (
          <span
            aria-hidden="true"
            style={{
              display: "block",
              width: 40,
              height: 4,
              borderRadius: 999,
              background: "var(--line)",
              margin: "0 auto 14px",
            }}
          />
        ) : null}
        <p className="sb-label" style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          {display.setName}
        </p>
        <p
          className="sb-display"
          style={{
            margin: "4px 0 0",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            textWrap: "balance",
          }}
        >
          {display.name}
        </p>
        <dl
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            margin: "14px 0 0",
          }}
        >
          <div className="sb-data" style={CHIP_STYLE}>
            <dt style={CHIP_LABEL}>N.º</dt>
            <dd style={CHIP_VALUE}>{display.number}</dd>
          </div>
          <div style={CHIP_STYLE}>
            <dt style={CHIP_LABEL}>Variante</dt>
            <dd style={CHIP_VALUE}>{display.variant}</dd>
          </div>
          {display.rarity ? (
            <div style={CHIP_STYLE}>
              <dt style={CHIP_LABEL}>Rareza</dt>
              <dd style={CHIP_VALUE}>{display.rarity}</dd>
            </div>
          ) : null}
          {copy ? (
            <>
              <div style={CHIP_STYLE}>
                <dt style={CHIP_LABEL}>Idioma</dt>
                <dd style={CHIP_VALUE}>{languageLabel(copy.language)}</dd>
              </div>
              <div style={CHIP_STYLE}>
                <dt style={CHIP_LABEL}>Condición</dt>
                <dd style={CHIP_VALUE}>{conditionLabel(copy.condition)}</dd>
              </div>
              {copy.grading ? (
                <div style={CHIP_STYLE}>
                  <dt style={CHIP_LABEL}>Gradeo</dt>
                  <dd style={CHIP_VALUE}>{copy.grading}</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>
        {pocketMeta?.price || status ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              margin: "14px 0 0",
              paddingTop: 14,
              borderTop: "1px solid var(--line)",
            }}
          >
            {pocketMeta?.price ? (
              <dl style={{ margin: 0 }}>
                <dt style={{ ...CHIP_LABEL, margin: 0 }}>Precio</dt>
                <dd
                  className="sb-data"
                  style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "var(--ink)" }}
                >
                  {pocketMeta.price}
                </dd>
                {pocketMeta.estimated ? (
                  <dd style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    estimado por condición
                  </dd>
                ) : null}
              </dl>
            ) : null}
            {status && statusColors ? (
              <span
                className="sb-label"
                style={{
                  ...CHIP_STYLE,
                  ...statusColors,
                  fontSize: 13,
                  fontWeight: 700,
                  marginLeft: "auto",
                  alignItems: "center",
                }}
              >
                {STATUS_LABELS[status]}
              </span>
            ) : null}
          </div>
        ) : null}
        {/* Phones: the caption repeats the chips; skip it to leave room for the card. */}
        {sidePanel ? (
          <p
            className="sb-data"
            style={{
              margin: "14px 0 0",
              fontSize: 12,
              color: "var(--muted)",
              overflowWrap: "anywhere",
            }}
          >
            {caption}
          </p>
        ) : null}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 16,
          }}
        >
          {flipButton}
          {wish && <WishlistToggle inList={wish.inList} onToggle={wish.onToggle} />}
          {want && pocketCode && (
            <WantListToggle
              inList={want.has(pocketCode)}
              sold={pocketMeta?.status === "vendido"}
              onToggle={() => want.toggle(pocketCode)}
            />
          )}
        </div>
      </motion.section>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="cfo-close"
        style={{
          position: "absolute",
          top: sidePanel ? 24 : 12,
          right: sidePanel ? 24 : 12,
          width: 44,
          height: 44,
          borderRadius: 999,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink)",
          boxShadow: "var(--shadow)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

const PANEL_BASE_STYLE: CSSProperties = {
  boxSizing: "border-box",
  background: "var(--surface)",
  color: "var(--ink)",
  boxShadow: "0 24px 60px rgba(17, 20, 32, 0.35), 0 2px 6px rgba(17, 20, 32, 0.12)",
};
