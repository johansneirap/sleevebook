"use client";

import { defaultFoilMask } from "@sleevebook/binder-core";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import { HoloGl } from "../card-render/holo-gl";
import { type PocketMeta, STATUS_LABELS } from "../seller-public/types";
import { useWantList } from "../seller-public/want-list";
import { CardBack } from "./card-back";
import { FlipCard } from "./flip-card";

const CARD_ASPECT_RATIO = 88 / 63;
const CARD_MAX_WIDTH = 340;
const CARD_MIN_WIDTH = 160;
/** From this viewport width up, the catalog panel sits beside the card. */
const SIDE_PANEL_MIN_VIEWPORT = 1000;
const SIDE_PANEL_WIDTH = 260;
const SIDE_PANEL_GAP = 48;
const DESKTOP_VERTICAL_MARGIN = 72;
const EDGE = 16;
/** Height kept free under the card on phones for the catalog panel. */
const PHONE_PANEL_RESERVE = 200;

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
  // The card's bottom edge must clear the panel pinned to the bottom.
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

// Velvet ground with a warm spotlight centered on the card.
const BACKDROP_BACKGROUND = [
  "radial-gradient(circle at 50% 50%, rgba(212, 183, 124, 0.12) 0%, transparent 34%)",
  "radial-gradient(ellipse 60% 62% at 50% 50%, rgba(62, 44, 33, 0.7) 0%, rgba(20, 15, 12, 0.94) 42%, rgba(6, 4, 3, 0.99) 100%)",
].join(", ");

// Seller mode: adds the focused card to the buyer's list. Vendido cannot be added.
function WantListToggle({
  inList,
  sold,
  onToggle,
  sidePanel,
}: {
  inList: boolean;
  sold: boolean;
  onToggle: () => void;
  sidePanel: boolean;
}) {
  const label = sold ? "Carta vendida" : inList ? "Quitar de mi lista" : "Agregar a mi lista";
  return (
    <button
      type="button"
      className="sb-label cfo-flip"
      disabled={sold}
      onClick={onToggle}
      style={{
        marginTop: sidePanel ? 18 : 12,
        padding: "4px 0",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--rule)",
        color: inList ? "var(--foil)" : "var(--linen)",
        fontSize: 12,
        cursor: sold ? "default" : "pointer",
        opacity: sold ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );
}

// Fase 4: the viewer's own wishlist ("mis deseos"). Separate from the buyer
// list above; quiet, text only.
function WishlistToggle({
  inList,
  onToggle,
  sidePanel,
}: {
  inList: boolean;
  onToggle: () => void;
  sidePanel: boolean;
}) {
  return (
    <button
      type="button"
      className="sb-label cfo-flip"
      aria-pressed={inList}
      onClick={onToggle}
      style={{
        marginTop: sidePanel ? 18 : 12,
        padding: "4px 0",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--rule)",
        color: inList ? "var(--foil)" : "var(--linen)",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {inList ? "En mis deseos" : "Agregar a mis deseos"}
    </button>
  );
}

const LABEL_STYLE = {
  margin: 0,
  fontSize: 11,
  color: "var(--smoke)",
} as const;

const VALUE_STYLE = {
  margin: "6px 0 0",
  fontSize: 14,
  color: "var(--linen)",
} as const;

export function CardFocusOverlay({
  display,
  sleeve,
  origin,
  onClose,
  pocketCode,
  pocketMeta,
  wish,
}: {
  display: VariantDisplay;
  sleeve: string;
  origin: FocusOrigin;
  onClose: () => void;
  /** Seller mode only: the focused pocket and its price/status. */
  pocketCode?: string;
  pocketMeta?: PocketMeta;
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
  const { cardWidth, sidePanel } = layout;

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
        initial: { x: origin.x, y: origin.y, scale: origin.scale, opacity: 1 },
        animate: { x: 0, y: 0, scale: 1, opacity: 1 },
        exit: { x: origin.x, y: origin.y, scale: origin.scale, opacity: 1 },
        transition: SPRING,
      };

  // Desktop: the panel hangs off the right edge of the centered card, so the
  // card itself never moves off-center. Phone: a strip pinned to the bottom.
  const panelPlacement = sidePanel
    ? {
        left: `calc(50% + ${cardWidth / 2 + SIDE_PANEL_GAP}px)`,
        top: "50%",
        width: SIDE_PANEL_WIDTH,
        transform: "translateY(-50%)",
      }
    : {
        left: 0,
        right: 0,
        bottom: 0,
        padding: "28px 16px calc(20px + env(safe-area-inset-bottom, 0px))",
        background: "linear-gradient(to top, rgba(6, 4, 3, 0.97) 62%, rgba(6, 4, 3, 0))",
      };

  const flipButton = (
    <button
      type="button"
      className="sb-label cfo-flip"
      aria-pressed={flipped}
      onClick={() => setFlipped((value) => !value)}
      style={{
        marginTop: sidePanel ? 18 : 12,
        padding: "4px 0",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--rule)",
        color: flipped ? "var(--foil)" : "var(--linen)",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      Voltear carta
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      style={{ position: "fixed", inset: 0, zIndex: 50 }}
    >
      <style>{`
        .cfo-flip { transition: color 250ms var(--ease-out-expo), border-color 250ms var(--ease-out-expo); }
        .cfo-flip:hover { color: var(--foil); border-color: var(--foil); }
        .cfo-flip:focus-visible { outline: 1px solid var(--foil); outline-offset: 4px; }
      `}</style>
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
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
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
      </div>
      <motion.section
        aria-label="Datos de catálogo"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reducedMotion ? REDUCED_FADE : BACKDROP_FADE}
        style={{
          position: "absolute",
          ...panelPlacement,
          color: "var(--linen)",
        }}
      >
        <p className="sb-label" style={{ ...LABEL_STYLE, fontSize: 12 }}>
          {display.setName}
        </p>
        <p
          className="sb-display"
          style={{
            margin: "8px 0 0",
            fontSize: sidePanel ? 40 : 28,
            color: "var(--linen)",
            textWrap: "balance",
          }}
        >
          {display.name}
        </p>
        <dl
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px 28px",
            margin: sidePanel ? "24px 0 0" : "16px 0 0",
          }}
        >
          <div>
            <dt className="sb-label" style={LABEL_STYLE}>
              N.º
            </dt>
            <dd className="sb-data" style={VALUE_STYLE}>
              {display.number}
            </dd>
          </div>
          <div>
            <dt className="sb-label" style={LABEL_STYLE}>
              Variante
            </dt>
            <dd className="sb-data" style={VALUE_STYLE}>
              {display.variant}
            </dd>
          </div>
          {display.rarity ? (
            <div>
              <dt className="sb-label" style={LABEL_STYLE}>
                Rareza
              </dt>
              <dd className="sb-data" style={VALUE_STYLE}>
                {display.rarity}
              </dd>
            </div>
          ) : null}
          {pocketMeta?.price ? (
            <div>
              <dt className="sb-label" style={LABEL_STYLE}>
                Precio
              </dt>
              <dd className="sb-data" style={{ ...VALUE_STYLE, color: "var(--foil)" }}>
                {pocketMeta.price}
              </dd>
            </div>
          ) : null}
          {pocketMeta?.status ? (
            <div>
              <dt className="sb-label" style={LABEL_STYLE}>
                Estado
              </dt>
              <dd className="sb-label" style={VALUE_STYLE}>
                {STATUS_LABELS[pocketMeta.status]}
              </dd>
            </div>
          ) : null}
        </dl>
        <div
          aria-hidden="true"
          style={{
            height: 1,
            background: "var(--rule)",
            margin: sidePanel ? "24px 0 14px" : "16px 0 10px",
          }}
        />
        <p className="sb-data" style={{ ...LABEL_STYLE, margin: 0 }}>
          {caption}
        </p>
        {(want && pocketCode) || wish ? (
          // The toggles sit beside the flip button on one row.
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 24 }}>
            {flipButton}
            {want && pocketCode && (
              <WantListToggle
                inList={want.has(pocketCode)}
                sold={pocketMeta?.status === "vendido"}
                onToggle={() => want.toggle(pocketCode)}
                sidePanel={sidePanel}
              />
            )}
            {wish && (
              <WishlistToggle inList={wish.inList} onToggle={wish.onToggle} sidePanel={sidePanel} />
            )}
          </div>
        ) : (
          flipButton
        )}
      </motion.section>
    </div>
  );
}
