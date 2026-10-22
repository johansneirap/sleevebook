"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import {
  computeBinderValueUsd,
  formatPocketCode,
  gradingLabel,
  panelCoverageMap,
} from "@sleevebook/binder-core";
import { motion } from "motion/react";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import type { VariantDisplay } from "../../lib/binders";
import { createCopyForPocket, linkPocketCopy } from "../../lib/collection-actions";
import {
  computeImportLayout,
  type ImportDestination,
  type ImportFormat,
  type ImportMode,
  type ImportPreview,
  previewImport,
} from "../../lib/import-actions";
import { addPanel, removePanel } from "../../lib/panel-actions";
import { applyPocketChanges, type PocketChange, type PocketValue } from "../../lib/pocket-actions";
import { searchCardVariants } from "../../lib/search";
import {
  computeSortedLayout,
  type GroupField,
  type SortableField,
  type SortCriterion,
} from "../../lib/sort-actions";
import { type ThemeInput, updateBinderTheme } from "../../lib/theme-actions";
import { SLEEVE_LABELS, sleeveOverlayStyle, THEME_PRESETS } from "../../lib/theme-presets";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import { CopyBadge } from "./copy-badge";
import { type CopyCandidate, CopySection, type NewCopyInput } from "./copy-section";
import { HoloCard } from "./holo-card";
import { PanelCell } from "./panel-cell";

const SORT_FIELD_OPTIONS: { value: SortableField; label: string }[] = [
  { value: "era", label: "Era" },
  { value: "releasedAt", label: "Fecha de lanzamiento" },
  { value: "setName", label: "Set" },
  { value: "number", label: "Número" },
  { value: "name", label: "Nombre" },
  { value: "rarity", label: "Rareza" },
  { value: "variant", label: "Variante" },
];

const IMPORT_PLACEHOLDER: Record<ImportFormat, string> = {
  decklist: "4 Riolu MEG 76\n3 Mega Lucario ex MEG 77",
  csv: "name,set,number,variant,qty\nRiolu,MEG,76,normal,4",
};

// Editor styles (design brief v2 "Estante"). The faces are paper pages with
// sleeves, the same look as the binder viewer but drawn here on purpose: the
// editor must not depend on the viewer's components. The side column is a stack
// of cards; from 1100px it sits beside the pages. Every selector is prefixed
// with .sb-ed so these rules beat the global button and input defaults.
const EDITOR_CSS = `
.sb-ed { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; color: var(--ink); min-width: 0; }
.sb-ed-main { min-width: 0; }
.sb-ed-side { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; min-width: 0; align-content: start; }
.sb-ed .sb-ed-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: 10px; margin-bottom: 16px; box-sizing: border-box;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius-lg); box-shadow: var(--shadow);
}
.sb-ed .sb-ed-sep { width: 1px; height: 28px; background: var(--line); margin: 0 4px; }
.sb-ed .sb-ed-value {
  margin-left: auto; display: inline-flex; align-items: center; min-height: 32px;
  padding: 0 12px; border-radius: 999px; background: var(--surface-2);
  font-family: var(--font-data); font-size: 13px; font-weight: 700;
  font-variant-numeric: tabular-nums; color: var(--ink);
}
.sb-ed .sb-ed-tool,
.sb-ed .sb-ed-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px; padding: 0 14px; box-sizing: border-box;
  border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
  color: var(--ink); font-family: var(--font-ui); font-size: 14px; font-weight: 600;
  line-height: 1.2; cursor: pointer;
  transition: background-color 180ms var(--ease-out-expo), border-color 180ms var(--ease-out-expo);
}
.sb-ed .sb-ed-tool svg { width: 18px; height: 18px; flex: none; }
.sb-ed .sb-ed-tool:hover:not(:disabled),
.sb-ed .sb-ed-btn:hover:not(:disabled) { background: var(--surface-2); }
.sb-ed .sb-ed-btn-block { width: 100%; }
.sb-ed .sb-ed-btn-primary,
.sb-ed .sb-ed-btn-primary:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: #ffffff; }
.sb-ed .sb-ed-btn-primary:hover:not(:disabled) { background: var(--accent-strong); border-color: var(--accent-strong); }
.sb-ed .sb-ed-btn-ghost,
.sb-ed .sb-ed-btn-ghost:hover:not(:disabled) { background: transparent; border-color: transparent; color: var(--accent); }
.sb-ed .sb-ed-btn-ghost:hover:not(:disabled) { background: var(--accent-soft); }
.sb-ed .sb-ed-btn-danger,
.sb-ed .sb-ed-btn-danger:hover:not(:disabled) { background: transparent; border-color: transparent; color: var(--danger); }
.sb-ed .sb-ed-btn-danger:hover:not(:disabled) { background: var(--danger-soft); }
.sb-ed .sb-ed-tray {
  display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;
  padding: 20px; box-sizing: border-box;
  background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-lg);
}
.sb-ed .sb-ed-page {
  position: relative; box-sizing: border-box; flex: 1 1 300px; max-width: 420px; min-width: 0;
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 16px 18px 20px;
  background: linear-gradient(90deg, var(--binder-paper) 85%, var(--binder-paper-edge));
  border: 1px solid var(--binder-paper-edge);
  border-radius: 8px 4px 4px 8px;
  box-shadow: inset -10px 0 18px -12px rgba(27, 32, 51, 0.22), 0 1px 2px rgba(27, 32, 51, 0.08), 0 12px 24px -16px rgba(27, 32, 51, 0.35);
}
.sb-ed .sb-ed-page:nth-child(even) {
  background: linear-gradient(270deg, var(--binder-paper) 85%, var(--binder-paper-edge));
  border-radius: 4px 8px 8px 4px;
  box-shadow: inset 10px 0 18px -12px rgba(27, 32, 51, 0.22), 0 1px 2px rgba(27, 32, 51, 0.08), 0 12px 24px -16px rgba(27, 32, 51, 0.35);
}
.sb-ed .sb-ed-page-head {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 700; color: var(--muted);
}
.sb-ed .sb-ed-grid { display: grid; gap: 8px; width: 100%; }
.sb-ed .sb-ed-pocket {
  --sleeve-bg: linear-gradient(115deg, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0.6) 48%, rgba(255, 255, 255, 0) 60%), rgba(220, 224, 236, 0.35);
  position: relative; display: block; width: 100%; aspect-ratio: 63 / 88;
  box-sizing: border-box; padding: 0; margin: 0; border: 0; border-radius: 6px;
  background: var(--sleeve-bg); color: var(--ink); font: inherit; overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(27, 32, 51, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: box-shadow 200ms var(--ease-out-expo), background-color 200ms var(--ease-out-expo);
}
.sb-ed .sb-ed-pocket:hover { background: var(--sleeve-bg); box-shadow: inset 0 0 0 1px rgba(27, 32, 51, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.9); }
.sb-ed .sb-ed-pocket[data-selected="true"] { --sleeve-bg: var(--accent-soft); box-shadow: 0 0 0 2px var(--accent); }
.sb-ed .sb-ed-pocket[data-over="true"] { --sleeve-bg: var(--accent-soft); box-shadow: 0 0 0 2px var(--accent), 0 0 0 6px color-mix(in srgb, var(--accent) 22%, transparent); }
.sb-ed .sb-ed-pocket:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sb-ed .sb-ed-pocket-layout { position: relative; width: 100%; height: 100%; }
.sb-ed .sb-ed-pocket-inner {
  position: absolute; inset: 4px; display: flex; align-items: center; justify-content: center;
  border-radius: 4px; overflow: hidden; box-sizing: border-box;
}
.sb-ed .sb-ed-pocket-inner[data-dashed="true"] { border: 1.5px dashed #cdd2e0; }
.sb-ed .sb-ed-slot-code {
  font-family: var(--font-data); font-size: 10px; font-weight: 700;
  font-variant-numeric: tabular-nums; color: var(--muted);
}
.sb-ed .sb-ed-label {
  margin: 4px; padding: 4px 6px; border-radius: 6px; background: var(--surface);
  box-shadow: 0 1px 3px rgba(27, 32, 51, 0.15); font-size: 10px; font-weight: 700;
  line-height: 1.3; text-align: center; color: var(--ink); overflow-wrap: anywhere;
}
.sb-ed .sb-ed-card-img { width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 3px; }
.sb-ed .sb-ed-count {
  position: absolute; top: 6px; right: 6px; z-index: 1; min-width: 20px; padding: 0 6px;
  border-radius: 999px; background: var(--accent); color: #ffffff; text-align: center;
  font-family: var(--font-data); font-size: 10px; font-weight: 700; line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.sb-ed .sb-ed-overlay { position: absolute; inset: 0; border-radius: 3px; pointer-events: none; }
.sb-ed .sb-ed-card {
  box-sizing: border-box; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 16px;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius-lg); box-shadow: var(--shadow);
}
.sb-ed .sb-ed-card-title { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--ink); }
.sb-ed .sb-ed-section { display: block; padding: 0 16px; }
.sb-ed .sb-ed-section > summary {
  list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
  gap: 12px; min-height: 52px; font-size: 15px; font-weight: 700; color: var(--ink);
}
.sb-ed .sb-ed-section > summary::-webkit-details-marker { display: none; }
.sb-ed .sb-ed-section > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }
.sb-ed .sb-ed-chev { width: 18px; height: 18px; flex: none; color: var(--muted); transition: transform 200ms var(--ease-out-expo); }
.sb-ed .sb-ed-section[open] > summary .sb-ed-chev { transform: rotate(180deg); }
.sb-ed .sb-ed-section-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; min-width: 0; padding: 4px 0 16px; }
.sb-ed .sb-ed-field { display: grid; gap: 6px; min-width: 0; font-size: 13px; font-weight: 600; color: var(--muted); }
.sb-ed .sb-ed-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
.sb-ed .sb-ed-row > .sb-ed-field { flex: 1 1 120px; }
.sb-ed .sb-ed-check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; color: var(--ink); cursor: pointer; }
.sb-ed .sb-ed-check input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
.sb-ed input[type="text"],
.sb-ed input[type="number"],
.sb-ed select,
.sb-ed textarea {
  box-sizing: border-box; width: 100%; min-height: 44px; padding: 8px 12px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
  color: var(--ink); font-family: var(--font-ui); font-size: 14px; font-weight: 500;
}
.sb-ed textarea { min-height: 120px; font-family: var(--font-data); font-size: 13px; resize: vertical; }
.sb-ed input[type="range"] { width: 100%; accent-color: var(--accent); }
.sb-ed .sb-ed-note { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.sb-ed .sb-ed-error {
  margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--danger-soft);
  color: var(--danger); font-size: 13px; font-weight: 600; line-height: 1.4;
}
.sb-ed .sb-ed-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.sb-ed .sb-ed-line {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 44px;
  padding: 6px 10px; box-sizing: border-box; border-radius: 12px;
  background: var(--surface-2); font-size: 13px; color: var(--ink);
}
.sb-ed .sb-ed-chip {
  display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px;
  background: var(--accent-soft); color: var(--accent-strong);
  font-family: var(--font-data); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.sb-ed .sb-ed-num { font-family: var(--font-data); font-variant-numeric: tabular-nums; color: var(--muted); font-weight: 600; }
.sb-ed .sb-ed-code { font-family: var(--font-data); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--accent); }
.sb-ed .sb-ed-price { font-family: var(--font-data); font-variant-numeric: tabular-nums; }
.sb-ed .sb-ed-price-box { display: grid; gap: 10px; padding: 12px; border-radius: 14px; background: var(--surface-2); }
.sb-ed .sb-ed-search { position: relative; }
.sb-ed .sb-ed-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--muted); pointer-events: none; }
.sb-ed .sb-ed-search input { padding-left: 36px; }
.sb-ed .sb-ed-results {
  list-style: none; margin: 0; padding: 0; display: grid; gap: 8px;
  max-height: 380px; overflow-y: auto;
}
.sb-ed .sb-ed-result {
  display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; align-items: start;
  padding: 10px; box-sizing: border-box; border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
}
.sb-ed .sb-ed-result-thumb { width: 40px; height: 56px; border-radius: 6px; object-fit: cover; background: var(--surface-2); display: block; }
.sb-ed .sb-ed-result-meta { min-width: 0; font-size: 13px; line-height: 1.4; color: var(--ink); overflow-wrap: anywhere; }
.sb-ed .sb-ed-result-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.sb-ed .sb-ed-result-actions .sb-ed-btn { min-height: 44px; padding: 0 10px; font-size: 13px; }
.sb-ed .sb-ed-inspector-hint { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); }
.sb-ed .sb-ed-selected-title { margin: 0; font-size: 14px; color: var(--ink); }
.sb-ed .sb-ed-caption { margin: 0; font-size: 13px; color: var(--muted); }
.sb-ed .sb-ed-copy-badge { position: absolute; left: 4px; bottom: 4px; z-index: 1; max-width: calc(100% - 8px); pointer-events: none; }
.sb-ed .sb-ed-copy { display: grid; gap: 10px; padding: 12px; border-radius: 14px; background: var(--surface-2); }
.sb-ed .sb-ed-copy-title { margin: 0; font-size: 13px; font-weight: 700; color: var(--muted); }
.sb-ed .sb-ed-copy-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.sb-ed .sb-ed-copy-ask { display: grid; gap: 8px; padding: 10px; border-radius: 12px; background: var(--accent-soft); }
.sb-ed .sb-ed-copy-new { display: grid; gap: 8px; }
.sb-ed .sb-ed-copy-where { flex: 1 1 100%; font-size: 12px; color: var(--muted); }
.sb-ed .sb-ed-copy-pick .sb-ed-line { flex-wrap: wrap; }
.sb-ed .sb-ed-copy-pick .sb-ed-line .sb-ed-btn { margin-left: auto; min-height: 44px; padding: 0 12px; font-size: 13px; }
@media (min-width: 1100px) {
  .sb-ed { grid-template-columns: minmax(0, 1fr) 360px; gap: 28px; }
  .sb-ed-side {
    position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto;
    padding: 0 4px 4px 0; scrollbar-width: thin;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sb-ed .sb-ed-pocket,
  .sb-ed .sb-ed-tool,
  .sb-ed .sb-ed-btn,
  .sb-ed .sb-ed-chev { transition: none; }
}
`;

/** A physical copy of one of the binder's cards, compact for the client. */
export interface EditorCopy {
  id: string;
  variantId: string;
  language: string;
  condition: string;
  /** "PSA 10"; null when raw. */
  grading: string | null;
  placedIn: { binderId: string; binderName: string; pocketCode: string } | null;
}

interface CopyPlacement {
  binderId: string;
  binderName: string;
  pocketCode: string;
}

interface BinderEditorProps {
  binderId: string;
  binderName: string;
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Record<string, VariantDisplay>;
  prices: Record<string, number>;
  theme: Layout["theme"];
  copies: EditorCopy[];
}

interface HistoryChange {
  pocketCode: string;
  before: PocketValue;
  after: PocketValue;
}

interface HistoryEntry {
  changes: HistoryChange[];
}

/** The pocket layout as the editor shows it, plus where each copy sits. */
interface LiveLayout {
  pockets: Record<string, PocketValue>;
  placements: Record<string, CopyPlacement>;
}

interface PendingMove {
  copyId: string;
  location: string;
}

function messageForCopyError(): string {
  return "No se pudo guardar la copia. Inténtalo de nuevo.";
}

/** "Mi binder · S1·F·1" */
function pocketLabel(placement: CopyPlacement): string {
  return `${placement.binderName} · ${placement.pocketCode}`;
}

function placementsFromCopies(copies: EditorCopy[]): Record<string, CopyPlacement> {
  const placements: Record<string, CopyPlacement> = {};
  for (const copy of copies) {
    if (copy.placedIn) {
      placements[copy.id] = {
        binderId: copy.placedIn.binderId,
        binderName: copy.placedIn.binderName,
        pocketCode: copy.placedIn.pocketCode,
      };
    }
  }
  return placements;
}

/** Forgets a copy's place, but only if it is the given pocket that holds it. */
function releasePlacement(
  placements: Record<string, CopyPlacement>,
  copyId: string,
  binderId: string,
  pocketCode: string,
) {
  const placed = placements[copyId];
  if (placed?.binderId === binderId && placed.pocketCode === pocketCode) {
    delete placements[copyId];
  }
}

type SectionKey = "sort" | "import" | "theme" | "panels";

const SEARCH_DEBOUNCE_MS = 300;
const EMPTY_POCKET: PocketValue = { kind: "empty" };
// Critically-damped-ish spring (damping ratio ~1.0): settles without visible bounce.
const INSERT_SPRING = { type: "spring", stiffness: 150, damping: 25, mass: 1 } as const;
const INSERT_OFFSCREEN = { x: "80%", opacity: 0.6, scale: 1.02 } as const;
const INSERT_REST = { x: 0, opacity: 1, scale: 1 } as const;

/** Small 24px stroke icon used by the toolbar and the section headers. */
function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

function Pocket({
  code,
  content,
  display,
  isSelected,
  sleeve,
  gridPosition,
  layoutId,
  insertNonce,
  reduceMotion,
  copy,
  onSelect,
}: {
  code: string;
  content: PocketValue | undefined;
  display: VariantDisplay | undefined;
  isSelected: boolean;
  sleeve: string;
  gridPosition: { gridColumnStart: number; gridRowStart: number };
  layoutId?: string;
  // Set only for the pocket that received a card through the search "add card" path.
  insertNonce?: number;
  reduceMotion: boolean;
  // The copy linked to this pocket, when it is one of the owner's known copies.
  copy?: EditorCopy;
  onSelect: (code: string, additive: boolean) => void;
}) {
  const hasContent = !!content && content.kind !== "empty";
  // The insert animation starts once a card is actually rendered in the pocket
  // (the server action may still be in flight when the user clicks).
  const insertActive = insertNonce !== undefined && content?.kind === "card";
  const insertKey = insertActive ? `insert-${insertNonce}` : "idle";
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const inserting = insertActive && doneKey !== insertKey;
  const overlayStyle = sleeveOverlayStyle(sleeve);
  // Not disabling useDraggable for empty pockets on purpose: dnd-kit marks a
  // disabled draggable aria-disabled, which also blocks Playwright's (and a
  // screen reader's) click on it. handleDragEnd already ignores drags that
  // start from an empty pocket, so there's nothing to additionally disable.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: code });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: code });

  // A sleeve: the paper shows through a translucent film with a hairline and a
  // diagonal sheen. An empty pocket keeps a dashed frame inside the sleeve; the
  // selected one gets a 2px accent ring and an accent-soft fill, a drop target
  // the same ring with a soft halo.
  const dashed = content?.kind !== "card";
  const kind = content?.kind === "card" || content?.kind === "placeholder" ? content.kind : "empty";

  return (
    <button
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      type="button"
      {...listeners}
      {...attributes}
      onClick={(event) => onSelect(code, event.shiftKey || event.metaKey || event.ctrlKey)}
      className="sb-ed-pocket"
      style={{
        ...gridPosition,
        cursor: hasContent ? "grab" : "pointer",
        opacity: isDragging ? 0.3 : 1,
      }}
      data-kind={kind}
      data-selected={isSelected ? "true" : "false"}
      data-over={isOver ? "true" : undefined}
      data-inserting={inserting ? "true" : undefined}
    >
      <motion.div key={layoutId ?? code} layoutId={layoutId} className="sb-ed-pocket-layout">
        <motion.div
          key={insertKey}
          className="sb-ed-pocket-inner"
          data-dashed={dashed ? "true" : undefined}
          initial={insertActive ? (reduceMotion ? { opacity: 0 } : INSERT_OFFSCREEN) : false}
          animate={reduceMotion ? { opacity: 1 } : INSERT_REST}
          transition={reduceMotion ? { duration: 0.15, ease: "easeOut" } : INSERT_SPRING}
          onAnimationComplete={() => setDoneKey(insertKey)}
        >
          {content?.kind === "card" && content.count && content.count > 1 && (
            <span className="sb-ed-count">×{content.count}</span>
          )}
          {content?.kind === "card" && overlayStyle && (
            <span className="sb-ed-overlay" style={overlayStyle} />
          )}
          {content?.kind === "card" && display?.imageUrl ? (
            // biome-ignore lint/performance/noImgElement: editor MVP, no next/image config yet
            <img src={display.imageUrl} alt={display.name} className="sb-ed-card-img" />
          ) : display ? (
            <span className="sb-ed-label">
              {display.name} {display.number}
            </span>
          ) : (
            <span className="sb-ed-slot-code">{code}</span>
          )}
        </motion.div>
        {copy && (
          <span className="sb-ed-copy-badge">
            <CopyBadge language={copy.language} grading={copy.grading} size="sm" />
          </span>
        )}
      </motion.div>
    </button>
  );
}

export function BinderEditor({
  binderId,
  binderName,
  faces,
  format,
  pockets,
  panels,
  displays,
  prices,
  theme,
  copies,
}: BinderEditorProps) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantDisplay[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionKey, HTMLDetailsElement | null>>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [criteriaSlots, setCriteriaSlots] = useState<(SortCriterion | null)[]>([
    { field: "setName", dir: "asc" },
    null,
    null,
  ]);
  const [groupBy, setGroupBy] = useState<GroupField | null>(null);
  const [startOnNewSide, setStartOnNewSide] = useState(false);
  const [sortError, setSortError] = useState<string | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat>("decklist");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [importDestination, setImportDestination] = useState<ImportDestination>("end");
  const [importDestinationPocket, setImportDestinationPocket] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("perCopy");
  const [importError, setImportError] = useState<string | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [themePreset, setThemePreset] = useState(theme.preset);
  const [themeSleeve, setThemeSleeve] = useState(theme.sleeve);
  const [themeBg, setThemeBg] = useState(theme.bg ?? "");
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [panelAssetUrl, setPanelAssetUrl] = useState("");
  const [panelAnchor, setPanelAnchor] = useState("");
  const [panelRows, setPanelRows] = useState(1);
  const [panelCols, setPanelCols] = useState(1);
  const [panelZoom, setPanelZoom] = useState(100);
  const [panelX, setPanelX] = useState(50);
  const [panelY, setPanelY] = useState(50);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isAddingPanel, setIsAddingPanel] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [optimisticPockets, setOptimisticPockets] = useState<Record<string, PocketValue> | null>(
    null,
  );
  const [activeMoveIds, setActiveMoveIds] = useState<Map<string, string> | null>(null);
  // Pocket that should play the insert animation (set only by handleAddCard).
  // Cleared by any other pocket change, so undo/redo/drag/sort/import never replay it.
  const [insertion, setInsertion] = useState<{ code: string; nonce: number } | null>(null);
  const insertNonceRef = useRef(0);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Pocket changes wait for the server, as before: the grid follows the props
  // that the action's revalidation refreshes. Copy links are mirrored at once
  // (linkLocally) and the props replace them on the next refresh (below).
  const [synced, setSynced] = useState({ pockets, copies });
  const [live, setLive] = useState<LiveLayout>(() => ({
    pockets,
    placements: placementsFromCopies(copies),
  }));
  // Copy links live outside undo history (see replayChanges). This list holds
  // every copy shown in the editor, including ones created here.
  const [copyList, setCopyList] = useState<EditorCopy[]>(copies);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  if (synced.pockets !== pockets || synced.copies !== copies) {
    // Server refresh (new props object): adopt it. Adjusting state during render
    // is the React-sanctioned way to derive state from changed props.
    setSynced({ pockets, copies });
    setLive({ pockets, placements: placementsFromCopies(copies) });
    setCopyList(copies);
  }
  const effectivePockets = optimisticPockets ?? live.pockets;

  function getContent(code: string): PocketValue {
    return effectivePockets[code] ?? EMPTY_POCKET;
  }

  function runChanges(changes: PocketChange[]) {
    setInsertion(null);
    startTransition(async () => {
      await applyPocketChanges(binderId, changes);
    });
  }

  function recordAndRun(entries: HistoryChange[]) {
    setUndoStack((stack) => [...stack, { changes: entries }]);
    setRedoStack([]);
    runChanges(entries.map(({ pocketCode, after }) => ({ pocketCode, content: after })));
  }

  /**
   * Turns a history side ("before" for undo, "after" for redo) into writes that
   * keep the copies right. Each history entry remembers the instance a pocket
   * had at the time, but copies are linked and moved outside history, so that
   * snapshot can be stale. Rule:
   * - same card now as in the snapshot: keep the copy the pocket holds now;
   * - card changed: restore the snapshot's copy only if it is free (unplaced,
   *   or released by this same batch) and no other pocket of the batch claims it;
   * - otherwise the pocket goes without a copy.
   */
  function replayChanges(entries: HistoryChange[], side: "before" | "after"): PocketChange[] {
    const batchCodes = new Set(entries.map((entry) => entry.pocketCode));
    const claimed = new Set<string>();
    return entries.map(({ pocketCode, before, after }) => {
      const target = side === "before" ? before : after;
      if (target.kind !== "card") {
        return { pocketCode, content: target };
      }
      const now = effectivePockets[pocketCode];
      let instance: string | null;
      if (now?.kind === "card" && now.variant === target.variant) {
        instance = now.instance;
      } else {
        instance = target.instance;
        if (instance) {
          const holder = live.placements[instance];
          const free =
            !holder || (holder.binderId === binderId && batchCodes.has(holder.pocketCode));
          if (!free || claimed.has(instance)) {
            instance = null;
          }
        }
      }
      if (instance) {
        claimed.add(instance);
      }
      return { pocketCode, content: { ...target, instance } };
    });
  }

  function handleSelect(code: string, additive: boolean) {
    setSelectedCodes((current) => {
      if (additive) {
        return current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
      }
      return [code];
    });
    setQuery("");
    setResults([]);
    setPendingMove(null);
    setCopyError(null);
  }

  /** Toolbar buttons open the matching side card and bring it into view. */
  function openSection(key: SectionKey) {
    const section = sectionRefs.current[key];
    if (!section) {
      return;
    }
    section.open = true;
    section.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }

  function assignSingle(content: PocketValue) {
    if (selectedCodes.length !== 1) {
      return;
    }
    const code = selectedCodes[0] as string;
    recordAndRun([{ pocketCode: code, before: getContent(code), after: content }]);
  }

  // "Usar como carta" path: the only one that plays the insert animation.
  function handleAddCard(variant: string) {
    if (selectedCodes.length !== 1) {
      return;
    }
    const code = selectedCodes[0] as string;
    assignSingle({ kind: "card", variant, instance: null });
    insertNonceRef.current += 1;
    setInsertion({ code, nonce: insertNonceRef.current });
  }

  function handleSetPriceOverride() {
    if (!singleSelectedCode) {
      return;
    }
    const content = getContent(singleSelectedCode);
    if (content.kind !== "card") {
      return;
    }
    const amount = Number.parseFloat(priceInputRef.current?.value ?? "");
    if (!Number.isFinite(amount) || amount < 0) {
      return;
    }
    assignSingle({ ...content, priceOverrideUsd: amount });
  }

  function handleClearPriceOverride() {
    if (!singleSelectedCode) {
      return;
    }
    const content = getContent(singleSelectedCode);
    if (content.kind !== "card" || content.priceOverrideUsd === undefined) {
      return;
    }
    const { priceOverrideUsd, ...rest } = content;
    assignSingle(rest);
  }

  function bulkClear() {
    const entries = selectedCodes.map((code) => ({
      pocketCode: code,
      before: getContent(code),
      after: EMPTY_POCKET,
    }));
    recordAndRun(entries);
    setSelectedCodes([]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const fromCode = String(active.id);
    const toCode = String(over.id);
    const fromContent = getContent(fromCode);
    const toContent = getContent(toCode);
    if (
      fromContent.kind === "empty" ||
      fromContent.kind === "panel" ||
      toContent.kind === "panel"
    ) {
      return;
    }

    recordAndRun([
      { pocketCode: fromCode, before: fromContent, after: toContent },
      { pocketCode: toCode, before: toContent, after: fromContent },
    ]);
  }

  function handleUndo() {
    const entry = undoStack.at(-1);
    if (!entry) {
      return;
    }
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, entry]);
    runChanges(replayChanges(entry.changes, "before"));
  }

  function handleRedo() {
    const entry = redoStack.at(-1);
    if (!entry) {
      return;
    }
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, entry]);
    runChanges(replayChanges(entry.changes, "after"));
  }

  async function handleApplySort() {
    setSortError(null);
    setIsSorting(true);
    const criteria = criteriaSlots.filter((slot): slot is SortCriterion => slot !== null);
    const result = await computeSortedLayout(binderId, { criteria, groupBy, startOnNewSide });
    setIsSorting(false);

    if (!result.ok) {
      setSortError(result.error);
      return;
    }

    const changes: HistoryChange[] = [];
    for (const [code, after] of Object.entries(result.pockets)) {
      const before = getContent(code);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({ pocketCode: code, before, after });
      }
    }
    if (changes.length === 0) {
      return;
    }

    if (prefersReducedMotion || result.moves.length === 0) {
      recordAndRun(changes);
      return;
    }

    // Manual FLIP: paint the "before" frame (layoutIds on the old pocket
    // codes) synchronously so Motion can snapshot it, then on the next frame
    // move the layoutIds + optimistic pockets to their final codes. Without
    // flushSync here, React 18 would batch both updates into a single commit
    // and Motion would never see an intermediate state to animate from.
    const beforeMoveIds = new Map(result.moves.map((move) => [move.from, `move:${move.from}`]));
    flushSync(() => {
      setActiveMoveIds(beforeMoveIds);
    });
    requestAnimationFrame(() => {
      const afterMoveIds = new Map(result.moves.map((move) => [move.to, `move:${move.from}`]));
      setActiveMoveIds(afterMoveIds);
      setOptimisticPockets(result.pockets);
    });

    recordAndRun(changes);

    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
    }
    flipTimeoutRef.current = setTimeout(() => {
      setOptimisticPockets(null);
      setActiveMoveIds(null);
    }, 500);
  }

  async function handlePreviewImport() {
    setImportError(null);
    setIsPreviewingImport(true);
    const result = await previewImport(importFormat, importText);
    setIsPreviewingImport(false);
    setImportPreview(result);
  }

  function handleSelectCandidate(index: number, variantId: string) {
    setImportPreview((current) => {
      if (!current) {
        return current;
      }
      const lines = [...current.lines];
      const line = lines[index];
      if (!line) {
        return current;
      }
      const display =
        line.candidates.find((candidate) => candidate.id === variantId) ?? line.display;
      lines[index] = { ...line, variantId, display };
      return { ...current, lines };
    });
  }

  async function handleApplyImport() {
    if (!importPreview) {
      return;
    }
    setImportError(null);
    const importable = importPreview.lines.filter(
      (line): line is (typeof importPreview.lines)[number] & { variantId: string } =>
        line.status !== "not-found" && !!line.variantId,
    );
    if (importable.length === 0) {
      setImportError("No hay cartas resueltas para importar");
      return;
    }

    setIsApplyingImport(true);
    const result = await computeImportLayout(
      binderId,
      importable.map((line) => ({ quantity: line.quantity, variantId: line.variantId })),
      {
        destination: importDestination,
        destinationPocket: importDestination === "pocket" ? importDestinationPocket : null,
        mode: importMode,
      },
    );
    setIsApplyingImport(false);

    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    const changes: HistoryChange[] = [];
    for (const [code, after] of Object.entries(result.pockets)) {
      const before = getContent(code);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({ pocketCode: code, before, after });
      }
    }
    if (changes.length > 0) {
      recordAndRun(changes);
      setImportPreview(null);
      setImportText("");
    }
  }

  function handleSaveTheme() {
    const input: ThemeInput = {
      preset: themePreset,
      sleeve: themeSleeve,
      ...(themeBg.trim() ? { bg: themeBg.trim() } : {}),
    };
    setIsSavingTheme(true);
    startTransition(async () => {
      await updateBinderTheme(binderId, input);
      setIsSavingTheme(false);
    });
  }

  function handleUseSelectedPocketAsAnchor() {
    if (singleSelectedCode) {
      setPanelAnchor(singleSelectedCode);
    }
  }

  async function handleAddPanel() {
    setPanelError(null);
    if (!panelAssetUrl.trim() || !panelAnchor.trim()) {
      setPanelError("Hace falta una URL de imagen y un bolsillo de anclaje.");
      return;
    }
    setIsAddingPanel(true);
    const result = await addPanel(binderId, {
      assetUrl: panelAssetUrl.trim(),
      anchorCode: panelAnchor.trim(),
      rows: panelRows,
      cols: panelCols,
      zoom: panelZoom,
      x: panelX,
      y: panelY,
    });
    setIsAddingPanel(false);
    if (!result.ok) {
      setPanelError(result.error);
      return;
    }
    setPanelAssetUrl("");
    setPanelAnchor("");
  }

  function handleRemovePanel(panelId: string) {
    startTransition(async () => {
      await removePanel(binderId, panelId);
    });
  }

  // Copy links (Fase 7). The server calls are in collection-actions.ts; the
  // results are mirrored here at once. Copy links are NOT in undo history:
  // undo/redo only rewrites card identity, and replayChanges keeps the copies.
  function linkLocally(pocketCode: string, copyId: string | null) {
    setLive((state) => {
      const content = state.pockets[pocketCode];
      if (content?.kind !== "card") {
        return state;
      }
      const pockets = { ...state.pockets };
      const placements = { ...state.placements };
      if (content.instance) {
        releasePlacement(placements, content.instance, binderId, pocketCode);
      }
      if (copyId) {
        // A copy moved here from another pocket of this binder leaves that pocket.
        const holder = placements[copyId];
        if (holder?.binderId === binderId && holder.pocketCode !== pocketCode) {
          const other = pockets[holder.pocketCode];
          if (other?.kind === "card" && other.instance === copyId) {
            pockets[holder.pocketCode] = { ...other, instance: null };
          }
        }
        placements[copyId] = { binderId, binderName, pocketCode };
      }
      pockets[pocketCode] = { ...content, instance: copyId };
      return { pockets, placements };
    });
  }

  async function pickCopy(copyId: string, move = false) {
    if (!singleSelectedCode) {
      return;
    }
    const code = singleSelectedCode;
    setCopyError(null);
    const placed = live.placements[copyId];
    if (!move && placed && !(placed.binderId === binderId && placed.pocketCode === code)) {
      setPendingMove({ copyId, location: pocketLabel(placed) });
      return;
    }
    setCopyBusy(true);
    try {
      const result = await linkPocketCopy(binderId, code, copyId, move);
      if (!result.ok) {
        setPendingMove({
          copyId,
          location: `${result.binderName} · ${result.pocketCode}`,
        });
        return;
      }
      setPendingMove(null);
      linkLocally(code, copyId);
    } catch {
      setCopyError(messageForCopyError());
    } finally {
      setCopyBusy(false);
    }
  }

  async function unlinkCopy() {
    if (!singleSelectedCode) {
      return;
    }
    const code = singleSelectedCode;
    setCopyError(null);
    setCopyBusy(true);
    try {
      await linkPocketCopy(binderId, code, null);
      linkLocally(code, null);
    } catch {
      setCopyError(messageForCopyError());
    } finally {
      setCopyBusy(false);
    }
  }

  async function createCopy(input: NewCopyInput) {
    if (!singleSelectedCode) {
      return;
    }
    const code = singleSelectedCode;
    const content = getContent(code);
    if (content.kind !== "card") {
      return;
    }
    setCopyError(null);
    setCopyBusy(true);
    try {
      const copyId = await createCopyForPocket(binderId, code, input);
      setCopyList((list) => [
        ...list,
        {
          id: copyId,
          variantId: content.variant,
          language: input.language,
          condition: input.condition,
          grading: gradingLabel({
            gradingCompany: input.gradingCompany,
            gradingGrade: input.gradingGrade,
          }),
          placedIn: null,
        },
      ]);
      linkLocally(code, copyId);
    } catch {
      setCopyError(messageForCopyError());
    } finally {
      setCopyBusy(false);
    }
  }

  function onSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      const found = await searchCardVariants(value);
      setResults(found);
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);
  }

  const singleSelectedCode = selectedCodes.length === 1 ? selectedCodes[0] : null;
  const selectedContent = singleSelectedCode ? getContent(singleSelectedCode) : null;
  const copyById = new Map(copyList.map((copy) => [copy.id, copy]));
  const selectedCopy =
    selectedContent?.kind === "card" && selectedContent.instance
      ? copyById.get(selectedContent.instance)
      : undefined;
  const copyCandidates: CopyCandidate[] =
    selectedContent?.kind === "card"
      ? copyList
          .filter(
            (copy) =>
              copy.variantId === selectedContent.variant && copy.id !== selectedContent.instance,
          )
          .map((copy) => {
            const placed = live.placements[copy.id];
            return {
              id: copy.id,
              language: copy.language,
              condition: copy.condition,
              grading: copy.grading,
              location: placed ? `En ${pocketLabel(placed)}` : "Suelta",
            };
          })
      : [];
  const totalValueUsd = computeBinderValueUsd(effectivePockets, prices);
  const panelCoverage = panelCoverageMap(panels, format);

  return (
    <div className="sb-ed">
      <style>{EDITOR_CSS}</style>
      <div className="sb-ed-main">
        <div className="sb-ed-toolbar" role="toolbar" aria-label="Herramientas del binder">
          <button
            type="button"
            className="sb-ed-tool"
            onClick={handleUndo}
            disabled={undoStack.length === 0 || isPending}
          >
            <Svg>
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </Svg>
            Deshacer
          </button>
          <button
            type="button"
            className="sb-ed-tool"
            onClick={handleRedo}
            disabled={redoStack.length === 0 || isPending}
          >
            <Svg>
              <path d="m15 14 5-5-5-5" />
              <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
            </Svg>
            Rehacer
          </button>
          <span className="sb-ed-sep" aria-hidden="true" />
          <button type="button" className="sb-ed-tool" onClick={() => openSection("sort")}>
            <Svg>
              <path d="M3 6h18" />
              <path d="M6 12h12" />
              <path d="M10 18h4" />
            </Svg>
            Ordenar
          </button>
          <button type="button" className="sb-ed-tool" onClick={() => openSection("import")}>
            <Svg>
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </Svg>
            Importar
          </button>
          <button type="button" className="sb-ed-tool" onClick={() => openSection("theme")}>
            <Svg>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18" />
              <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" />
            </Svg>
            Estilo
          </button>
          <button type="button" className="sb-ed-tool" onClick={() => openSection("panels")}>
            <Svg>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-5-5L5 21" />
            </Svg>
            Paneles
          </button>
          {totalValueUsd > 0 && (
            <span className="sb-ed-value sb-ed-price">
              Valor total del binder: ${totalValueUsd.toFixed(2)} USD
            </span>
          )}
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="sb-ed-tray">
            {faces.map((face) => (
              <section key={`${face.sheet}-${face.side}`} className="sb-ed-page">
                <div className="sb-ed-page-head">
                  <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                    Hoja {face.sheet} · {face.side === "F" ? "Frente" : "Reverso"}
                  </h2>
                </div>
                <div
                  className="sb-ed-grid"
                  style={{ gridTemplateColumns: `repeat(${format.cols}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: format.rows * format.cols }, (_, i) => {
                    const code = formatPocketCode({
                      sheet: face.sheet,
                      side: face.side,
                      index: i + 1,
                    });
                    const gridPosition = {
                      gridColumnStart: (i % format.cols) + 1,
                      gridRowStart: Math.floor(i / format.cols) + 1,
                    };

                    const coveredBy = panelCoverage.get(code);
                    if (coveredBy) {
                      if (!coveredBy.isAnchor) {
                        return null;
                      }
                      return (
                        <PanelCell
                          key={code}
                          asset={coveredBy.panel.asset}
                          rows={coveredBy.panel.span.rows}
                          cols={coveredBy.panel.span.cols}
                          crop={coveredBy.panel.crop}
                          style={gridPosition}
                        />
                      );
                    }

                    const content = effectivePockets[code];
                    const display =
                      content?.kind === "card" || content?.kind === "placeholder"
                        ? displays[content.variant]
                        : undefined;
                    return (
                      <Pocket
                        key={code}
                        code={code}
                        content={content}
                        display={display}
                        isSelected={selectedCodes.includes(code)}
                        sleeve={theme.sleeve}
                        gridPosition={gridPosition}
                        layoutId={activeMoveIds?.get(code)}
                        insertNonce={insertion?.code === code ? insertion.nonce : undefined}
                        reduceMotion={prefersReducedMotion}
                        copy={
                          content?.kind === "card" && content.instance
                            ? copyById.get(content.instance)
                            : undefined
                        }
                        onSelect={handleSelect}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </DndContext>
      </div>

      <aside className="sb-ed-side">
        <section className="sb-ed-card" aria-labelledby="sb-ed-inspector-title">
          <h2 id="sb-ed-inspector-title" className="sb-ed-card-title">
            Bolsillos
          </h2>

          {selectedCodes.length === 0 && (
            <p className="sb-ed-inspector-hint">
              Toca un bolsillo para editarlo, o arrastra una carta a otro bolsillo. Shift/Cmd-click
              para seleccionar varios.
            </p>
          )}

          {selectedCodes.length > 1 && (
            <div className="sb-ed-row">
              <p className="sb-ed-selected-title" style={{ flex: "1 1 100%" }}>
                {selectedCodes.length} bolsillos seleccionados
              </p>
              <button
                type="button"
                className="sb-ed-btn sb-ed-btn-danger"
                disabled={isPending}
                onClick={bulkClear}
              >
                Vaciar seleccionados
              </button>
              <button type="button" className="sb-ed-btn" onClick={() => setSelectedCodes([])}>
                Cancelar selección
              </button>
            </div>
          )}

          {singleSelectedCode && (
            <>
              <p className="sb-ed-selected-title">
                Editando <strong className="sb-ed-code">{singleSelectedCode}</strong>
              </p>

              {selectedContent?.kind === "card" && displays[selectedContent.variant] && (
                <div>
                  <HoloCard
                    imageUrl={displays[selectedContent.variant]?.imageUrl ?? null}
                    name={displays[selectedContent.variant]?.name ?? ""}
                    variant={displays[selectedContent.variant]?.variant ?? "normal"}
                    sleeve={theme.sleeve}
                    width={180}
                  />
                </div>
              )}

              <div className="sb-ed-row">
                <button
                  type="button"
                  className="sb-ed-btn sb-ed-btn-danger"
                  disabled={isPending}
                  onClick={() => assignSingle(EMPTY_POCKET)}
                >
                  Vaciar
                </button>
              </div>

              {selectedContent?.kind === "card" && (
                <div className="sb-ed-price-box">
                  <p className="sb-ed-caption">
                    Precio de mercado:{" "}
                    {prices[selectedContent.variant] !== undefined
                      ? `$${(prices[selectedContent.variant] as number).toFixed(2)} USD`
                      : "sin dato"}
                    {selectedContent.priceOverrideUsd !== undefined &&
                      ` — Precio propio: $${selectedContent.priceOverrideUsd.toFixed(2)} USD`}
                  </p>
                  <label className="sb-ed-field">
                    <span>Precio propio (USD)</span>
                    <input
                      key={singleSelectedCode}
                      ref={priceInputRef}
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label="Precio propio en dólares"
                      defaultValue={selectedContent.priceOverrideUsd ?? ""}
                    />
                  </label>
                  <div className="sb-ed-row">
                    <button
                      type="button"
                      className="sb-ed-btn sb-ed-btn-primary"
                      disabled={isPending}
                      onClick={handleSetPriceOverride}
                    >
                      Guardar precio propio
                    </button>
                    {selectedContent.priceOverrideUsd !== undefined && (
                      <button
                        type="button"
                        className="sb-ed-btn sb-ed-btn-danger"
                        disabled={isPending}
                        onClick={handleClearPriceOverride}
                      >
                        Quitar precio propio
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedContent?.kind === "card" && (
                <CopySection
                  key={`${singleSelectedCode}-${selectedCopy?.id ?? "none"}`}
                  linked={
                    selectedCopy
                      ? {
                          id: selectedCopy.id,
                          language: selectedCopy.language,
                          condition: selectedCopy.condition,
                          grading: selectedCopy.grading,
                        }
                      : null
                  }
                  candidates={copyCandidates}
                  pendingMove={pendingMove ? { location: pendingMove.location } : null}
                  busy={copyBusy || isPending}
                  error={copyError}
                  onPick={(copyId) => void pickCopy(copyId)}
                  onConfirmMove={() => {
                    if (pendingMove) {
                      void pickCopy(pendingMove.copyId, true);
                    }
                  }}
                  onCancelMove={() => setPendingMove(null)}
                  onUnlink={() => void unlinkCopy()}
                  onCreate={createCopy}
                />
              )}

              <div className="sb-ed-search">
                <Svg>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </Svg>
                <input
                  type="text"
                  placeholder="Buscar carta por nombre..."
                  value={query}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>
              {isSearching && <p className="sb-ed-caption">Buscando...</p>}
              <ul className="sb-ed-results">
                {results.map((result) => (
                  <li key={result.id} className="sb-ed-result">
                    {result.imageUrl ? (
                      // biome-ignore lint/performance/noImgElement: editor MVP, no next/image config yet
                      <img src={result.imageUrl} alt="" className="sb-ed-result-thumb" />
                    ) : (
                      <span aria-hidden="true" className="sb-ed-result-thumb" />
                    )}
                    <div className="sb-ed-result-meta">
                      <span>
                        {result.setName} — {result.name}{" "}
                        <span className="sb-ed-num">{result.number}</span> ({result.variant}){" "}
                      </span>
                      <div className="sb-ed-result-actions">
                        <button
                          type="button"
                          className="sb-ed-btn sb-ed-btn-primary"
                          disabled={isPending}
                          onClick={() => handleAddCard(result.id)}
                        >
                          Usar como carta
                        </button>
                        <button
                          type="button"
                          className="sb-ed-btn"
                          disabled={isPending}
                          onClick={() =>
                            assignSingle({
                              kind: "placeholder",
                              variant: result.id,
                              style: "ficha",
                            })
                          }
                        >
                          Usar como placeholder
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <details
          ref={(node) => {
            sectionRefs.current.sort = node;
          }}
          className="sb-ed-card sb-ed-section"
        >
          <summary>
            Reordenar binder
            <Svg className="sb-ed-chev">
              <path d="m6 9 6 6 6-6" />
            </Svg>
          </summary>
          <div className="sb-ed-section-body">
            {criteriaSlots.map((slot, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3 slots (Criterio 1/2/3), never reordered/inserted/removed
              <div key={index} className="sb-ed-row">
                <div className="sb-ed-field">
                  <select
                    aria-label={`Criterio ${index + 1}: campo`}
                    value={slot?.field ?? ""}
                    onChange={(event) => {
                      const field = event.target.value as SortableField | "";
                      setCriteriaSlots((current) => {
                        const next = [...current];
                        next[index] = field ? { field, dir: slot?.dir ?? "asc" } : null;
                        return next;
                      });
                    }}
                  >
                    {index > 0 && <option value="">— sin usar —</option>}
                    {SORT_FIELD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {slot && (
                  <div className="sb-ed-field" style={{ flex: "0 1 150px" }}>
                    <select
                      aria-label={`Criterio ${index + 1}: dirección`}
                      value={slot.dir}
                      onChange={(event) => {
                        const dir = event.target.value as "asc" | "desc";
                        setCriteriaSlots((current) => {
                          const next = [...current];
                          next[index] = { field: slot.field, dir };
                          return next;
                        });
                      }}
                    >
                      <option value="asc">Ascendente</option>
                      <option value="desc">Descendente</option>
                    </select>
                  </div>
                )}
              </div>
            ))}

            <div className="sb-ed-field">
              <select
                aria-label="Agrupar por"
                value={groupBy ?? ""}
                onChange={(event) =>
                  setGroupBy(event.target.value ? (event.target.value as GroupField) : null)
                }
              >
                <option value="">Sin agrupar</option>
                <option value="era">Agrupar por era</option>
                <option value="setName">Agrupar por set</option>
              </select>
            </div>

            <label className="sb-ed-check">
              <input
                type="checkbox"
                checked={startOnNewSide}
                disabled={!groupBy}
                onChange={(event) => setStartOnNewSide(event.target.checked)}
              />
              Empezar cada sección en cara nueva
            </label>

            {sortError && <p className="sb-ed-error">{sortError}</p>}

            <button
              type="button"
              className="sb-ed-btn sb-ed-btn-primary sb-ed-btn-block"
              onClick={handleApplySort}
              disabled={isSorting || isPending}
            >
              Aplicar orden
            </button>
          </div>
        </details>

        <details
          ref={(node) => {
            sectionRefs.current.import = node;
          }}
          className="sb-ed-card sb-ed-section"
        >
          <summary>
            Importar cartas
            <Svg className="sb-ed-chev">
              <path d="m6 9 6 6 6-6" />
            </Svg>
          </summary>
          <div className="sb-ed-section-body">
            <div className="sb-ed-field">
              <select
                aria-label="Formato de importación"
                value={importFormat}
                onChange={(event) => setImportFormat(event.target.value as ImportFormat)}
              >
                <option value="decklist">Lista PTCGL / Limitless</option>
                <option value="csv">CSV (name,set,number,variant,qty)</option>
              </select>
            </div>
            <textarea
              aria-label="Texto a importar"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={6}
              placeholder={IMPORT_PLACEHOLDER[importFormat]}
            />
            <button
              type="button"
              className="sb-ed-btn sb-ed-btn-block"
              onClick={handlePreviewImport}
              disabled={isPreviewingImport || importText.trim().length === 0}
            >
              Previsualizar
            </button>

            {importPreview && (
              <>
                <p className="sb-ed-caption">
                  {importPreview.lines.filter((line) => line.status === "resolved").length}{" "}
                  resueltas,{" "}
                  {importPreview.lines.filter((line) => line.status === "ambiguous").length}{" "}
                  ambiguas,{" "}
                  {importPreview.lines.filter((line) => line.status === "not-found").length} no
                  encontradas
                  {importPreview.unparsed.length > 0 &&
                    ` (${importPreview.unparsed.length} líneas no reconocidas)`}
                </p>

                <ul className="sb-ed-list" style={{ maxHeight: 240, overflowY: "auto" }}>
                  {importPreview.lines.map((line, index) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat (same raw text, different row); index matches the preview array position used by handleSelectCandidate
                      key={index}
                      className="sb-ed-line"
                    >
                      <span className="sb-ed-chip">×{line.quantity}</span>
                      {line.status === "not-found" ? (
                        <span style={{ color: "var(--danger)" }}>
                          {line.raw} — {line.error}
                        </span>
                      ) : line.status === "ambiguous" ? (
                        <>
                          <span>{line.raw}</span>
                          <select
                            aria-label={`Elegir impresión para ${line.raw}`}
                            value={line.variantId ?? ""}
                            onChange={(event) => handleSelectCandidate(index, event.target.value)}
                            style={{ flex: "1 1 180px" }}
                          >
                            {line.candidates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.variant} ({candidate.setName})
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span>
                          {line.display?.name} {line.display?.number} ({line.display?.variant})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="sb-ed-field">
                  <span>Destino</span>
                  <select
                    aria-label="Destino de importación"
                    value={importDestination}
                    onChange={(event) =>
                      setImportDestination(event.target.value as ImportDestination)
                    }
                  >
                    <option value="end">Al final</option>
                    <option value="pocket">Desde un bolsillo específico</option>
                    <option value="newSide">Empezar en cara nueva</option>
                  </select>
                </div>
                {importDestination === "pocket" && (
                  <input
                    aria-label="Bolsillo de destino"
                    type="text"
                    placeholder="S1·F·1"
                    value={importDestinationPocket}
                    onChange={(event) => setImportDestinationPocket(event.target.value)}
                  />
                )}

                <div className="sb-ed-field">
                  <span>Cantidad</span>
                  <select
                    aria-label="Modo de cantidad"
                    value={importMode}
                    onChange={(event) => setImportMode(event.target.value as ImportMode)}
                  >
                    <option value="perCopy">Una copia por bolsillo</option>
                    <option value="singleWithCount">Todas las copias en un bolsillo (×N)</option>
                  </select>
                </div>

                {importError && <p className="sb-ed-error">{importError}</p>}

                <button
                  type="button"
                  className="sb-ed-btn sb-ed-btn-primary sb-ed-btn-block"
                  onClick={handleApplyImport}
                  disabled={isApplyingImport || isPending}
                >
                  Aplicar importación
                </button>
              </>
            )}
          </div>
        </details>

        <details
          ref={(node) => {
            sectionRefs.current.theme = node;
          }}
          className="sb-ed-card sb-ed-section"
        >
          <summary>
            Tema
            <Svg className="sb-ed-chev">
              <path d="m6 9 6 6 6-6" />
            </Svg>
          </summary>
          <div className="sb-ed-section-body">
            <label className="sb-ed-field">
              <span>Preset</span>
              <select
                aria-label="Preset de tema"
                value={themePreset}
                onChange={(event) => setThemePreset(event.target.value)}
              >
                {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sb-ed-field">
              <span>Funda</span>
              <select
                aria-label="Textura de funda"
                value={themeSleeve}
                onChange={(event) => setThemeSleeve(event.target.value)}
              >
                {Object.entries(SLEEVE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sb-ed-field">
              <span>Fondo personalizado (opcional)</span>
              <input
                type="text"
                aria-label="Color de fondo personalizado"
                placeholder="#223344"
                value={themeBg}
                onChange={(event) => setThemeBg(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="sb-ed-btn sb-ed-btn-primary sb-ed-btn-block"
              onClick={handleSaveTheme}
              disabled={isSavingTheme || isPending}
            >
              Guardar tema
            </button>
          </div>
        </details>

        <details
          ref={(node) => {
            sectionRefs.current.panels = node;
          }}
          className="sb-ed-card sb-ed-section"
        >
          <summary>
            Paneles de arte
            <Svg className="sb-ed-chev">
              <path d="m6 9 6 6 6-6" />
            </Svg>
          </summary>
          <div className="sb-ed-section-body">
            <label className="sb-ed-field">
              <span>URL de la imagen</span>
              <input
                type="text"
                aria-label="URL de la imagen del panel"
                placeholder="https://..."
                value={panelAssetUrl}
                onChange={(event) => setPanelAssetUrl(event.target.value)}
              />
            </label>

            <div className="sb-ed-row">
              <label className="sb-ed-field">
                <span>Bolsillo de anclaje</span>
                <input
                  type="text"
                  aria-label="Bolsillo de anclaje del panel"
                  placeholder="S1·F·1"
                  value={panelAnchor}
                  onChange={(event) => setPanelAnchor(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="sb-ed-btn sb-ed-btn-ghost"
                onClick={handleUseSelectedPocketAsAnchor}
                disabled={!singleSelectedCode}
              >
                Usar seleccionado
              </button>
            </div>

            <div className="sb-ed-row">
              <label className="sb-ed-field" style={{ flex: "0 1 96px" }}>
                <span>Filas</span>
                <input
                  type="number"
                  aria-label="Filas del panel"
                  min={1}
                  max={format.rows}
                  value={panelRows}
                  onChange={(event) => setPanelRows(Number.parseInt(event.target.value, 10) || 1)}
                />
              </label>
              <label className="sb-ed-field" style={{ flex: "0 1 96px" }}>
                <span>Columnas</span>
                <input
                  type="number"
                  aria-label="Columnas del panel"
                  min={1}
                  max={format.cols}
                  value={panelCols}
                  onChange={(event) => setPanelCols(Number.parseInt(event.target.value, 10) || 1)}
                />
              </label>
              <button
                type="button"
                className="sb-ed-btn sb-ed-btn-ghost"
                onClick={() => {
                  setPanelRows(format.rows);
                  setPanelCols(format.cols);
                }}
              >
                Página completa
              </button>
            </div>

            <label className="sb-ed-field">
              <span>Zoom: {panelZoom}%</span>
              <input
                type="range"
                aria-label="Zoom del panel"
                min={100}
                max={300}
                value={panelZoom}
                onChange={(event) => setPanelZoom(Number.parseInt(event.target.value, 10))}
              />
            </label>
            <label className="sb-ed-field">
              <span>Posición horizontal: {panelX}%</span>
              <input
                type="range"
                aria-label="Posición horizontal del panel"
                min={0}
                max={100}
                value={panelX}
                onChange={(event) => setPanelX(Number.parseInt(event.target.value, 10))}
              />
            </label>
            <label className="sb-ed-field">
              <span>Posición vertical: {panelY}%</span>
              <input
                type="range"
                aria-label="Posición vertical del panel"
                min={0}
                max={100}
                value={panelY}
                onChange={(event) => setPanelY(Number.parseInt(event.target.value, 10))}
              />
            </label>

            {panelAssetUrl.trim() && (
              <div style={{ display: "grid", gap: 6 }}>
                <p className="sb-ed-caption">Previsualización (sin cortar por bolsillo):</p>
                <PanelCell
                  asset={panelAssetUrl.trim()}
                  rows={1}
                  cols={1}
                  crop={{ x: panelX, y: panelY, zoom: panelZoom }}
                  style={{
                    width: 120,
                    maxWidth: "100%",
                    aspectRatio: `${panelCols} / ${panelRows}`,
                  }}
                />
              </div>
            )}

            {panelError && <p className="sb-ed-error">{panelError}</p>}

            <button
              type="button"
              className="sb-ed-btn sb-ed-btn-primary sb-ed-btn-block"
              onClick={handleAddPanel}
              disabled={isAddingPanel || isPending}
            >
              Agregar panel
            </button>

            {panels.length > 0 && (
              <ul className="sb-ed-list">
                {panels.map((panel) => (
                  <li key={panel.id} className="sb-ed-line">
                    <span style={{ flex: "1 1 auto" }}>
                      {panel.anchor} ({panel.span.rows}×{panel.span.cols})
                    </span>
                    <button
                      type="button"
                      className="sb-ed-btn sb-ed-btn-danger"
                      disabled={isPending}
                      onClick={() => handleRemovePanel(panel.id)}
                    >
                      Quitar panel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </aside>
    </div>
  );
}
