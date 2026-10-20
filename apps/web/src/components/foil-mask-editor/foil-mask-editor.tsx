"use client";

import {
  addZone,
  defaultFoilMask,
  FOIL_MODE_OPTIONS,
  type FoilMask,
  type FoilZone,
  type FoilZoneHandle,
  MAX_FOIL_ZONES,
  moveZone,
  nudgeForKey,
  removeZone,
  replaceZone,
  resizeZone,
  zoneFromPoints,
} from "@sleevebook/binder-core";
import Link from "next/link";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { resetFoilMask, saveFoilMask } from "../../lib/foil-mask-actions";
import "./foil-mask-editor.css";

interface FoilMaskEditorProps {
  variantId: string;
  cardName: string;
  /** Catalog variant ("holo", "reverse"...), used for the default mask. */
  variantKind: string;
  imageUrl: string | null;
  /** The saved mask, or the default when none is saved. */
  initialMask: FoilMask;
  /** True when a hand-made mask is saved (chip "Editada"). */
  initialEdited: boolean;
}

interface Point {
  x: number;
  y: number;
}

type DragState =
  | { kind: "draw"; start: Point; last: Point }
  | { kind: "move"; index: number; origin: FoilZone; start: Point }
  | {
      kind: "resize";
      index: number;
      handle: FoilZoneHandle;
      origin: FoilZone;
      start: Point;
    };

/** Pointer travel below this (card units) counts as a click, not a drawn zone. */
const MIN_DRAWN_ZONE = 0.01;

const HANDLES: ReadonlyArray<{ handle: FoilZoneHandle; left: string; top: string }> = [
  { handle: "nw", left: "0%", top: "0%" },
  { handle: "n", left: "50%", top: "0%" },
  { handle: "ne", left: "100%", top: "0%" },
  { handle: "e", left: "100%", top: "50%" },
  { handle: "se", left: "100%", top: "100%" },
  { handle: "s", left: "50%", top: "100%" },
  { handle: "sw", left: "0%", top: "100%" },
  { handle: "w", left: "0%", top: "50%" },
];

const CAPTIONS: Record<FoilMask["mode"], string> = {
  inside: "El brillo aparece solo dentro de las zonas.",
  outside: "El brillo aparece en todo menos en las zonas.",
  full: "El brillo cubre la carta entera.",
  none: "Sin foil: la carta no brilla.",
};

/** Cursor per resize handle: the corner and edge directions it moves. */
const HANDLE_CURSOR: Record<FoilZoneHandle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

const pct = (value: number) => `${Math.round(value * 100)}%`;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function sameMask(a: FoilMask, b: FoilMask): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function FoilMaskEditor({
  variantId,
  cardName,
  variantKind,
  imageUrl,
  initialMask,
  initialEdited,
}: FoilMaskEditorProps) {
  const uid = useId().replace(/:/g, "");
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [baseline, setBaseline] = useState({ mask: initialMask, edited: initialEdited });
  const [mask, setMask] = useState<FoilMask>(initialMask);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<FoilZone | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultMask = defaultFoilMask(variantKind);
  const dirty = !sameMask(mask, baseline.mask);
  const zonesIgnored = mask.mode === "full" || mask.mode === "none";
  const zoneCount = mask.zones.length;
  const atLimit = zoneCount >= MAX_FOIL_ZONES;

  function pointFromEvent(event: ReactPointerEvent<HTMLElement>): Point {
    const stage = stageRef.current;
    if (!stage) {
      return { x: 0, y: 0 };
    }
    const rect = stage.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  function beginDrag(event: ReactPointerEvent<HTMLElement>, state: DragState) {
    dragRef.current = state;
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function handleStagePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }
    if (atLimit) {
      setMessage({
        tone: "error",
        text: `Ya hay ${MAX_FOIL_ZONES} zonas. Elimina una para dibujar otra.`,
      });
      return;
    }
    const point = pointFromEvent(event);
    setSelected(null);
    beginDrag(event, { kind: "draw", start: point, last: point });
  }

  function handleStagePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const point = pointFromEvent(event);
    if (drag.kind === "draw") {
      dragRef.current = { ...drag, last: point };
      setDraft(zoneFromPoints(drag.start, point));
      return;
    }
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    const next =
      drag.kind === "move"
        ? moveZone(drag.origin, dx, dy)
        : resizeZone(drag.origin, drag.handle, dx, dy);
    setMask((current) => ({ ...current, zones: replaceZone(current.zones, drag.index, next) }));
  }

  function handleStagePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) {
      return;
    }
    if (drag.kind === "draw") {
      setDraft(null);
      const travelX = Math.abs(drag.last.x - drag.start.x);
      const travelY = Math.abs(drag.last.y - drag.start.y);
      if (travelX < MIN_DRAWN_ZONE && travelY < MIN_DRAWN_ZONE) {
        return;
      }
      if (atLimit) {
        return;
      }
      const zone = zoneFromPoints(drag.start, drag.last);
      setMask((current) => ({ ...current, zones: addZone(current.zones, zone) }));
      setSelected(zoneCount);
      setMessage(null);
    }
  }

  function handleZonePointerDown(event: ReactPointerEvent<HTMLElement>, index: number) {
    event.stopPropagation();
    const origin = mask.zones[index];
    if (!origin) {
      return;
    }
    setSelected(index);
    beginDrag(event, {
      kind: "move",
      index,
      origin,
      start: pointFromEvent(event),
    });
  }

  function handleHandlePointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
    index: number,
    handle: FoilZoneHandle,
  ) {
    event.stopPropagation();
    const origin = mask.zones[index];
    if (!origin) {
      return;
    }
    setSelected(index);
    beginDrag(event, {
      kind: "resize",
      index,
      handle,
      origin,
      start: pointFromEvent(event),
    });
  }

  function removeAt(index: number) {
    setMask((current) => ({ ...current, zones: removeZone(current.zones, index) }));
    setSelected(null);
  }

  function addDefaultZone() {
    if (atLimit) {
      setMessage({
        tone: "error",
        text: `Ya hay ${MAX_FOIL_ZONES} zonas. Elimina una para añadir otra.`,
      });
      return;
    }
    setMask((current) => ({
      ...current,
      zones: addZone(current.zones, { x: 0.25, y: 0.25, w: 0.5, h: 0.25 }),
    }));
    setSelected(zoneCount);
    setMessage(null);
  }

  function handleZoneKeyDown(event: ReactKeyboardEvent<HTMLElement>, index: number) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeAt(index);
      return;
    }
    if (event.key === "Escape") {
      setSelected(null);
      event.currentTarget.blur();
      return;
    }
    const nudge = nudgeForKey(event.key);
    const zone = mask.zones[index];
    if (!nudge || !zone) {
      return;
    }
    event.preventDefault();
    const next = event.shiftKey
      ? resizeZone(zone, "se", nudge.dx, nudge.dy)
      : moveZone(zone, nudge.dx, nudge.dy);
    setMask((current) => ({ ...current, zones: replaceZone(current.zones, index, next) }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveFoilMask(variantId, mask);
        setBaseline({ mask, edited: true });
        setMessage({ tone: "ok", text: "Máscara guardada." });
      } catch {
        setMessage({ tone: "error", text: "No se pudo guardar la máscara. Intenta de nuevo." });
      }
    });
  }

  function handleReset() {
    startTransition(async () => {
      try {
        await resetFoilMask(variantId);
        setMask(defaultMask);
        setBaseline({ mask: defaultMask, edited: false });
        setSelected(null);
        setMessage({ tone: "ok", text: "Volviste a la máscara por defecto." });
      } catch {
        setMessage({ tone: "error", text: "No se pudo restablecer la máscara. Intenta de nuevo." });
      }
    });
  }

  const previewVisible = mask.mode !== "none";
  const zoneIgnoredNote = zonesIgnored && zoneCount > 0;
  const sheenGradient = `sb-foil-sheen-${uid}`;
  const maskId = `sb-foil-mask-${uid}`;

  return (
    <div className="sb-foil-editor">
      <div className="sb-foil-editor-column">
        <div
          ref={stageRef}
          className="sb-foil-editor-stage"
          data-testid="foil-mask-stage"
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
        >
          {imageUrl ? (
            // biome-ignore lint/performance/noImgElement: card art from the catalog CDN
            <img className="sb-foil-editor-image" src={imageUrl} alt={cardName} draggable={false} />
          ) : (
            <span className="sb-foil-editor-noimage">Sin imagen</span>
          )}

          {previewVisible ? (
            <svg
              className="sb-foil-editor-preview"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                  <rect
                    width="100"
                    height="100"
                    fill={mask.mode === "outside" ? "white" : "black"}
                  />
                  {mask.zones.map((zone, index) => (
                    <rect
                      // biome-ignore lint/suspicious/noArrayIndexKey: zones have no ids and are only replaced in place
                      key={`zone-${index}`}
                      x={zone.x * 100}
                      y={zone.y * 100}
                      width={zone.w * 100}
                      height={zone.h * 100}
                      fill={mask.mode === "outside" ? "black" : "white"}
                    />
                  ))}
                </mask>
                <linearGradient id={sheenGradient} x1="0" x2="1" y1="0" y2="0">
                  {/* CSS variables only resolve in style, not in SVG presentation attributes. */}
                  <stop offset="0" style={{ stopColor: "var(--foil)", stopOpacity: 0 }} />
                  <stop offset="0.5" style={{ stopColor: "#ffffff", stopOpacity: 0.9 }} />
                  <stop offset="1" style={{ stopColor: "var(--foil)", stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <g mask={mask.mode === "full" ? undefined : `url(#${maskId})`}>
                <rect width="100" height="100" style={{ fill: "var(--foil)", fillOpacity: 0.42 }} />
                <g transform="skewX(-16)">
                  <rect
                    className="sb-foil-editor-sheen"
                    x="-20"
                    y="-10"
                    width="34"
                    height="120"
                    fill={`url(#${sheenGradient})`}
                  />
                </g>
              </g>
            </svg>
          ) : null}

          {mask.zones.map((zone, index) => {
            const isSelected = selected === index;
            return (
              <button
                type="button"
                // biome-ignore lint/suspicious/noArrayIndexKey: zones have no ids and are only replaced in place
                key={`zone-${index}`}
                className="sb-foil-editor-zone"
                aria-pressed={isSelected}
                aria-label={`Zona ${index + 1}: ${pct(zone.w)} de ancho por ${pct(zone.h)} de alto, a ${pct(zone.x)} de la izquierda y ${pct(zone.y)} desde arriba`}
                data-ignored={zonesIgnored ? "true" : undefined}
                data-selected={isSelected ? "true" : undefined}
                style={{
                  left: `${zone.x * 100}%`,
                  top: `${zone.y * 100}%`,
                  width: `${zone.w * 100}%`,
                  height: `${zone.h * 100}%`,
                }}
                onPointerDown={(event) => handleZonePointerDown(event, index)}
                onKeyDown={(event) => handleZoneKeyDown(event, index)}
                onFocus={() => setSelected(index)}
              >
                <span className="sb-foil-editor-zone-number" aria-hidden="true">
                  {index + 1}
                </span>
                {isSelected
                  ? HANDLES.map(({ handle, left, top }) => (
                      <span
                        key={handle}
                        className="sb-foil-editor-handle"
                        aria-hidden="true"
                        data-handle={handle}
                        style={{ left, top, cursor: HANDLE_CURSOR[handle] }}
                        onPointerDown={(event) => handleHandlePointerDown(event, index, handle)}
                      />
                    ))
                  : null}
              </button>
            );
          })}

          {draft ? (
            <div
              className="sb-foil-editor-zone sb-foil-editor-zone-draft"
              aria-hidden="true"
              style={{
                left: `${draft.x * 100}%`,
                top: `${draft.y * 100}%`,
                width: `${draft.w * 100}%`,
                height: `${draft.h * 100}%`,
              }}
            />
          ) : null}
        </div>
        <p className="sb-foil-editor-caption" aria-live="polite">
          {CAPTIONS[mask.mode]}
          {zoneIgnoredNote ? " Las zonas se guardan pero este modo no las usa." : ""}
        </p>
      </div>

      <div className="sb-foil-editor-column">
        <p className="sb-foil-editor-status">
          <span
            className={`sb-foil-editor-chip${baseline.edited ? " sb-foil-editor-chip-edited" : ""}`}
            data-testid="foil-mask-status"
          >
            {baseline.edited ? "Editada" : "Por defecto"}
          </span>
          <span className="sb-data">
            Zonas: {zoneCount} de {MAX_FOIL_ZONES}
          </span>
          {dirty ? <span className="sb-foil-editor-unsaved">Cambios sin guardar</span> : null}
        </p>

        <p className="sb-foil-editor-help">
          Arrastra sobre la carta para dibujar una zona. Toca una zona para moverla y usa sus
          esquinas para cambiar el tamaño. Con teclado: las flechas mueven la zona seleccionada 0,5
          %, Mayús + flechas la redimensionan y Suprimir la borra.
        </p>

        <div className="sb-foil-editor-tools">
          <button
            type="button"
            className="sb-mask-btn sb-mask-btn-secondary"
            onClick={addDefaultZone}
          >
            Añadir zona
          </button>
          <button
            type="button"
            className="sb-mask-btn sb-mask-btn-secondary"
            disabled={selected === null}
            onClick={() => {
              if (selected !== null) {
                removeAt(selected);
              }
            }}
          >
            Eliminar zona
          </button>
        </div>

        <fieldset className="sb-foil-editor-modes">
          <legend className="sb-label">Modo de foil</legend>
          {FOIL_MODE_OPTIONS.map((option) => (
            <label key={option.mode} className="sb-foil-editor-mode">
              <input
                type="radio"
                name={`sb-foil-mode-${uid}`}
                value={option.mode}
                checked={mask.mode === option.mode}
                onChange={() => setMask((current) => ({ ...current, mode: option.mode }))}
              />
              <span>
                <span className="sb-foil-editor-mode-label">{option.label}</span>
                <span className="sb-foil-editor-hint">{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="sb-foil-editor-actions">
          <button
            type="button"
            className="sb-mask-btn sb-mask-btn-primary"
            disabled={!dirty || pending}
            onClick={handleSave}
          >
            Guardar
          </button>
          <button
            type="button"
            className="sb-mask-btn sb-mask-btn-secondary"
            disabled={pending}
            onClick={handleReset}
          >
            Volver a la máscara por defecto
          </button>
          <Link
            href="/admin/mascaras"
            className="sb-mask-btn sb-mask-btn-secondary"
            onClick={(event) => {
              if (dirty && !window.confirm("Descartar los cambios sin guardar?")) {
                event.preventDefault();
              }
            }}
          >
            Cancelar
          </Link>
        </div>

        <p
          className={`sb-foil-editor-message${message?.tone === "error" ? " sb-foil-editor-message-error" : ""}`}
          role={message?.tone === "error" ? "alert" : "status"}
        >
          {message?.text ?? ""}
        </p>
      </div>
    </div>
  );
}
