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
import { computeBinderValueUsd, formatPocketCode, panelCoverageMap } from "@sleevebook/binder-core";
import { motion } from "motion/react";
import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import type { VariantDisplay } from "../../lib/binders";
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

// Layout-only CSS for the editor workbench: faces in the center, tool panels in
// a side column from 1100px, stacked below on narrower screens. Inline styles
// cannot express media queries, so these few rules live in a scoped <style>.
const EDITOR_CSS = `
.sb-ed { display: grid; gap: 32px; align-items: start; }
.sb-ed-faces { display: flex; flex-wrap: wrap; gap: 28px; justify-content: center; }
.sb-ed-side { min-width: 0; }
@media (min-width: 1100px) {
  .sb-ed { grid-template-columns: minmax(0, 1fr) 340px; gap: 56px; }
  .sb-ed-faces { justify-content: flex-start; }
  .sb-ed-side {
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding-right: 4px;
    scrollbar-width: thin;
  }
}
.sb-ed-section { border-bottom: 1px solid var(--rule); }
.sb-ed-section > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  font-family: var(--font-ui);
  font-size: 12px;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.14em;
  color: var(--smoke);
  transition: color 240ms var(--ease-out-expo);
}
.sb-ed-section > summary::-webkit-details-marker { display: none; }
.sb-ed-section > summary::after {
  content: "+";
  font-family: var(--font-data);
  font-size: 14px;
  color: var(--foil-dim);
}
.sb-ed-section[open] > summary::after { content: "\\2212"; }
.sb-ed-section > summary:hover { color: var(--linen); }
.sb-ed-section > div { padding: 2px 0 16px; }
.sb-ed-quiet,
.sb-ed-quiet:hover:not(:disabled) {
  background: transparent;
  border-color: transparent;
  padding: 4px 10px;
  font-size: 12px;
  color: color-mix(in srgb, var(--linen) 72%, transparent);
}
.sb-ed-quiet:hover:not(:disabled) { color: var(--linen); }
.sb-ed-results {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  max-height: 380px;
  overflow-y: auto;
  border-top: 1px solid var(--rule);
}
.sb-ed-result {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--linen) 8%, transparent);
  font-size: 12px;
}
.sb-ed-result-meta { min-width: 0; overflow-wrap: anywhere; }
.sb-ed-num {
  font-family: var(--font-data);
  font-variant-numeric: tabular-nums;
  color: var(--smoke);
}
.sb-ed-result-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.sb-ed-result-actions button { font-size: 11px; padding: 2px 8px; }
.sb-ed-selection strong {
  font-family: var(--font-data);
  font-weight: 400;
  color: var(--foil);
}
.sb-ed-price { font-family: var(--font-data); font-variant-numeric: tabular-nums; }
`;

interface BinderEditorProps {
  binderId: string;
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Record<string, VariantDisplay>;
  prices: Record<string, number>;
  theme: Layout["theme"];
}

interface HistoryChange {
  pocketCode: string;
  before: PocketValue;
  after: PocketValue;
}

interface HistoryEntry {
  changes: HistoryChange[];
}

const SEARCH_DEBOUNCE_MS = 300;
const EMPTY_POCKET: PocketValue = { kind: "empty" };
// Critically-damped-ish spring (damping ratio ~1.0): settles without visible bounce.
const INSERT_SPRING = { type: "spring", stiffness: 150, damping: 25, mass: 1 } as const;
const INSERT_OFFSCREEN = { x: "80%", opacity: 0.6, scale: 1.02 } as const;
const INSERT_REST = { x: 0, opacity: 1, scale: 1 } as const;

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

  // A sleeve: translucent hairline on the leather face, the card fills it.
  // Empty pockets stay a faint outline; the selected one gets a fine foil ring,
  // and a drop target a soft foil glow.
  const borderColor =
    isOver || isSelected
      ? "var(--foil)"
      : content?.kind === "placeholder"
        ? "var(--foil-dim)"
        : hasContent
          ? "color-mix(in srgb, var(--linen) 16%, transparent)"
          : "color-mix(in srgb, var(--linen) 9%, transparent)";
  const boxShadow = isOver
    ? "0 0 0 1px var(--foil), 0 0 26px 4px color-mix(in srgb, var(--foil) 26%, transparent)"
    : isSelected
      ? "0 0 0 1px var(--foil)"
      : "none";

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
      style={{
        position: "relative",
        aspectRatio: "63 / 88",
        ...gridPosition,
        borderWidth: 1,
        borderColor,
        borderStyle: content?.kind === "placeholder" ? "dashed" : "solid",
        borderRadius: 3,
        boxShadow,
        transition:
          "box-shadow 280ms var(--ease-out-expo), border-color 280ms var(--ease-out-expo)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontVariantCaps: "normal",
        letterSpacing: "normal",
        padding: 0,
        background: hasContent ? "color-mix(in srgb, var(--linen) 4%, transparent)" : "transparent",
        cursor: hasContent ? "grab" : "pointer",
        opacity: isDragging ? 0.3 : 1,
        overflow: "hidden",
      }}
      data-inserting={inserting ? "true" : undefined}
    >
      <motion.div
        key={layoutId ?? code}
        layoutId={layoutId}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.div
          key={insertKey}
          initial={insertActive ? (reduceMotion ? { opacity: 0 } : INSERT_OFFSCREEN) : false}
          animate={reduceMotion ? { opacity: 1 } : INSERT_REST}
          transition={reduceMotion ? { duration: 0.15, ease: "easeOut" } : INSERT_SPRING}
          onAnimationComplete={() => setDoneKey(insertKey)}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {content?.kind === "card" && content.count && content.count > 1 && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                zIndex: 1,
                background: "var(--velvet)",
                color: "var(--foil)",
                border: "1px solid var(--rule)",
                borderRadius: 2,
                padding: "0 4px",
                fontSize: 10,
                fontFamily: "var(--font-data)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ×{content.count}
            </span>
          )}
          {content?.kind === "card" && overlayStyle && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 3,
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--linen) 14%, transparent)",
                pointerEvents: "none",
                ...overlayStyle,
              }}
            />
          )}
          {content?.kind === "card" && display?.imageUrl ? (
            // biome-ignore lint/performance/noImgElement: editor MVP, no next/image config yet
            <img
              src={display.imageUrl}
              alt={display.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                borderRadius: 2,
              }}
            />
          ) : display ? (
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 10,
                lineHeight: 1.3,
                textAlign: "center",
                color: "var(--linen)",
                padding: 4,
              }}
            >
              {display.name} {display.number}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontVariantNumeric: "tabular-nums",
                fontSize: 10,
                letterSpacing: "0.04em",
                color: "var(--smoke)",
              }}
            >
              {code}
            </span>
          )}
        </motion.div>
      </motion.div>
    </button>
  );
}

export function BinderEditor({
  binderId,
  faces,
  format,
  pockets,
  panels,
  displays,
  prices,
  theme,
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
  const effectivePockets = optimisticPockets ?? pockets;

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

  function handleSelect(code: string, additive: boolean) {
    setSelectedCodes((current) => {
      if (additive) {
        return current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
      }
      return [code];
    });
    setQuery("");
    setResults([]);
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
    runChanges(entry.changes.map(({ pocketCode, before }) => ({ pocketCode, content: before })));
  }

  function handleRedo() {
    const entry = redoStack.at(-1);
    if (!entry) {
      return;
    }
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, entry]);
    runChanges(entry.changes.map(({ pocketCode, after }) => ({ pocketCode, content: after })));
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
  const totalValueUsd = computeBinderValueUsd(effectivePockets, prices);
  const panelCoverage = panelCoverageMap(panels, format);

  return (
    <div className="sb-ed">
      <style>{EDITOR_CSS}</style>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "center",
            paddingBottom: 10,
            marginBottom: 24,
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <button
            type="button"
            className="sb-ed-quiet"
            onClick={handleUndo}
            disabled={undoStack.length === 0 || isPending}
          >
            Deshacer
          </button>
          <button
            type="button"
            className="sb-ed-quiet"
            onClick={handleRedo}
            disabled={redoStack.length === 0 || isPending}
          >
            Rehacer
          </button>
          {totalValueUsd > 0 && (
            <span
              className="sb-ed-price"
              style={{ marginLeft: "auto", fontSize: 12, color: "var(--smoke)" }}
            >
              Valor total del binder: ${totalValueUsd.toFixed(2)} USD
            </span>
          )}
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="sb-ed-faces">
            {faces.map((face) => (
              <section
                key={`${face.sheet}-${face.side}`}
                style={{
                  background: "color-mix(in srgb, var(--leather) 88%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--linen) 9%, transparent)",
                  borderRadius: 6,
                  // Two faces side by side whenever the column fits them, like the open binder.
                  boxSizing: "border-box",
                  flex: "1 1 300px",
                  maxWidth: 400,
                  padding: "14px 18px 20px",
                  boxShadow: "inset 0 0 56px rgba(0, 0, 0, 0.38)",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 11,
                    fontWeight: 400,
                    fontVariantCaps: "all-small-caps",
                    letterSpacing: "0.14em",
                    color: "var(--smoke)",
                    margin: "0 0 14px",
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--rule)",
                  }}
                >
                  Hoja {face.sheet} · {face.side === "F" ? "Frente" : "Reverso"}
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${format.cols}, 1fr)`,
                    gap: 8,
                    width: "100%",
                  }}
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
        <details className="sb-ed-section">
          <summary>Reordenar binder</summary>
          <div>
            {criteriaSlots.map((slot, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3 slots (Criterio 1/2/3), never reordered/inserted/removed
              <div key={index} style={{ display: "flex", gap: 4, marginTop: 4 }}>
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
                {slot && (
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
                )}
              </div>
            ))}

            <div style={{ marginTop: 8 }}>
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

            <label style={{ display: "block", marginTop: 4 }}>
              <input
                type="checkbox"
                checked={startOnNewSide}
                disabled={!groupBy}
                onChange={(event) => setStartOnNewSide(event.target.checked)}
              />{" "}
              Empezar cada sección en cara nueva
            </label>

            {sortError && <p style={{ color: "#e8957f" }}>{sortError}</p>}

            <button type="button" onClick={handleApplySort} disabled={isSorting || isPending}>
              Aplicar orden
            </button>
          </div>
        </details>

        <details className="sb-ed-section">
          <summary>Importar cartas</summary>
          <div style={{ marginTop: 8 }}>
            <select
              aria-label="Formato de importación"
              value={importFormat}
              onChange={(event) => setImportFormat(event.target.value as ImportFormat)}
            >
              <option value="decklist">Lista PTCGL / Limitless</option>
              <option value="csv">CSV (name,set,number,variant,qty)</option>
            </select>
            <textarea
              aria-label="Texto a importar"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={6}
              style={{ width: "100%", marginTop: 4, fontFamily: "var(--font-data)", fontSize: 12 }}
              placeholder={IMPORT_PLACEHOLDER[importFormat]}
            />
            <button
              type="button"
              onClick={handlePreviewImport}
              disabled={isPreviewingImport || importText.trim().length === 0}
            >
              Previsualizar
            </button>

            {importPreview && (
              <>
                <p>
                  {importPreview.lines.filter((line) => line.status === "resolved").length}{" "}
                  resueltas,{" "}
                  {importPreview.lines.filter((line) => line.status === "ambiguous").length}{" "}
                  ambiguas,{" "}
                  {importPreview.lines.filter((line) => line.status === "not-found").length} no
                  encontradas
                  {importPreview.unparsed.length > 0 &&
                    ` (${importPreview.unparsed.length} líneas no reconocidas)`}
                </p>

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    maxHeight: 240,
                    overflowY: "auto",
                    fontSize: 12,
                  }}
                >
                  {importPreview.lines.map((line, index) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat (same raw text, different row); index matches the preview array position used by handleSelectCandidate
                      key={index}
                      style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <span className="sb-ed-num">×{line.quantity}</span>
                      {line.status === "not-found" ? (
                        <span style={{ color: "#e8957f" }}>
                          {line.raw} — {line.error}
                        </span>
                      ) : line.status === "ambiguous" ? (
                        <>
                          <span>{line.raw}</span>
                          <select
                            aria-label={`Elegir impresión para ${line.raw}`}
                            value={line.variantId ?? ""}
                            onChange={(event) => handleSelectCandidate(index, event.target.value)}
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

                <div style={{ marginTop: 8 }}>
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
                  {importDestination === "pocket" && (
                    <input
                      aria-label="Bolsillo de destino"
                      type="text"
                      placeholder="S1·F·1"
                      value={importDestinationPocket}
                      onChange={(event) => setImportDestinationPocket(event.target.value)}
                    />
                  )}
                </div>

                <div style={{ marginTop: 4 }}>
                  <select
                    aria-label="Modo de cantidad"
                    value={importMode}
                    onChange={(event) => setImportMode(event.target.value as ImportMode)}
                  >
                    <option value="perCopy">Una copia por bolsillo</option>
                    <option value="singleWithCount">Todas las copias en un bolsillo (×N)</option>
                  </select>
                </div>

                {importError && <p style={{ color: "#e8957f" }}>{importError}</p>}

                <button
                  type="button"
                  onClick={handleApplyImport}
                  disabled={isApplyingImport || isPending}
                >
                  Aplicar importación
                </button>
              </>
            )}
          </div>
        </details>

        <details className="sb-ed-section">
          <summary>Tema</summary>
          <div style={{ marginTop: 8 }}>
            <label>
              Preset:{" "}
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

            <div style={{ marginTop: 4 }}>
              <label>
                Funda:{" "}
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
            </div>

            <div style={{ marginTop: 4 }}>
              <label>
                Fondo personalizado (opcional):{" "}
                <input
                  type="text"
                  aria-label="Color de fondo personalizado"
                  placeholder="#223344"
                  value={themeBg}
                  onChange={(event) => setThemeBg(event.target.value)}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleSaveTheme}
              disabled={isSavingTheme || isPending}
              style={{ marginTop: 8 }}
            >
              Guardar tema
            </button>
          </div>
        </details>

        <details className="sb-ed-section">
          <summary>Paneles de arte</summary>
          <div style={{ marginTop: 8 }}>
            <label>
              URL de la imagen:{" "}
              <input
                type="text"
                aria-label="URL de la imagen del panel"
                placeholder="https://..."
                value={panelAssetUrl}
                onChange={(event) => setPanelAssetUrl(event.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <div style={{ marginTop: 4, display: "flex", gap: 4, alignItems: "center" }}>
              <label>
                Bolsillo de anclaje:{" "}
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
                onClick={handleUseSelectedPocketAsAnchor}
                disabled={!singleSelectedCode}
              >
                Usar seleccionado
              </button>
            </div>

            <div style={{ marginTop: 4, display: "flex", gap: 12 }}>
              <label>
                Filas:{" "}
                <input
                  type="number"
                  aria-label="Filas del panel"
                  min={1}
                  max={format.rows}
                  value={panelRows}
                  onChange={(event) => setPanelRows(Number.parseInt(event.target.value, 10) || 1)}
                  style={{ width: 56 }}
                />
              </label>
              <label>
                Columnas:{" "}
                <input
                  type="number"
                  aria-label="Columnas del panel"
                  min={1}
                  max={format.cols}
                  value={panelCols}
                  onChange={(event) => setPanelCols(Number.parseInt(event.target.value, 10) || 1)}
                  style={{ width: 56 }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setPanelRows(format.rows);
                  setPanelCols(format.cols);
                }}
              >
                Página completa
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              <label>
                Zoom: {panelZoom}%{" "}
                <input
                  type="range"
                  aria-label="Zoom del panel"
                  min={100}
                  max={300}
                  value={panelZoom}
                  onChange={(event) => setPanelZoom(Number.parseInt(event.target.value, 10))}
                />
              </label>
            </div>
            <div>
              <label>
                Posición horizontal: {panelX}%{" "}
                <input
                  type="range"
                  aria-label="Posición horizontal del panel"
                  min={0}
                  max={100}
                  value={panelX}
                  onChange={(event) => setPanelX(Number.parseInt(event.target.value, 10))}
                />
              </label>
            </div>
            <div>
              <label>
                Posición vertical: {panelY}%{" "}
                <input
                  type="range"
                  aria-label="Posición vertical del panel"
                  min={0}
                  max={100}
                  value={panelY}
                  onChange={(event) => setPanelY(Number.parseInt(event.target.value, 10))}
                />
              </label>
            </div>

            {panelAssetUrl.trim() && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, color: "var(--smoke)" }}>
                  Previsualización (sin cortar por bolsillo):
                </p>
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

            {panelError && <p style={{ color: "#e8957f" }}>{panelError}</p>}

            <button
              type="button"
              onClick={handleAddPanel}
              disabled={isAddingPanel || isPending}
              style={{ marginTop: 8 }}
            >
              Agregar panel
            </button>

            {panels.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
                {panels.map((panel) => (
                  <li key={panel.id} style={{ marginTop: 4, fontSize: 12 }}>
                    {panel.anchor} ({panel.span.rows}×{panel.span.cols}){" "}
                    <button
                      type="button"
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

        <div className="sb-ed-selection" style={{ padding: "18px 0 8px" }}>
          {selectedCodes.length === 0 && (
            <p>
              Hacé click en un bolsillo para editarlo, o arrastrá una carta a otro bolsillo.
              Shift/Cmd-click para seleccionar varios.
            </p>
          )}

          {selectedCodes.length > 1 && (
            <>
              <p>{selectedCodes.length} bolsillos seleccionados</p>
              <button type="button" disabled={isPending} onClick={bulkClear}>
                Vaciar seleccionados
              </button>{" "}
              <button type="button" onClick={() => setSelectedCodes([])}>
                Cancelar selección
              </button>
            </>
          )}

          {singleSelectedCode && (
            <>
              <p>
                Editando <strong>{singleSelectedCode}</strong>
              </p>

              {selectedContent?.kind === "card" && displays[selectedContent.variant] && (
                <div style={{ marginBottom: 8 }}>
                  <HoloCard
                    imageUrl={displays[selectedContent.variant]?.imageUrl ?? null}
                    name={displays[selectedContent.variant]?.name ?? ""}
                    variant={displays[selectedContent.variant]?.variant ?? "normal"}
                    sleeve={theme.sleeve}
                    width={180}
                  />
                </div>
              )}

              <button type="button" disabled={isPending} onClick={() => assignSingle(EMPTY_POCKET)}>
                Vaciar
              </button>

              {selectedContent?.kind === "card" && (
                <div style={{ marginTop: 8 }}>
                  <p>
                    Precio de mercado:{" "}
                    {prices[selectedContent.variant] !== undefined
                      ? `$${(prices[selectedContent.variant] as number).toFixed(2)} USD`
                      : "sin dato"}
                    {selectedContent.priceOverrideUsd !== undefined &&
                      ` — Precio propio: $${selectedContent.priceOverrideUsd.toFixed(2)} USD`}
                  </p>
                  <label>
                    Precio propio (USD):{" "}
                    <input
                      key={singleSelectedCode}
                      ref={priceInputRef}
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label="Precio propio en dólares"
                      defaultValue={selectedContent.priceOverrideUsd ?? ""}
                    />
                  </label>{" "}
                  <button type="button" disabled={isPending} onClick={handleSetPriceOverride}>
                    Guardar precio propio
                  </button>{" "}
                  {selectedContent.priceOverrideUsd !== undefined && (
                    <button type="button" disabled={isPending} onClick={handleClearPriceOverride}>
                      Quitar precio propio
                    </button>
                  )}
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="Buscar carta por nombre..."
                  value={query}
                  onChange={(event) => onSearchChange(event.target.value)}
                  style={{ width: "100%" }}
                />
                {isSearching && <p style={{ color: "var(--smoke)", fontSize: 12 }}>Buscando...</p>}
                <ul className="sb-ed-results">
                  {results.map((result) => (
                    <li key={result.id} className="sb-ed-result">
                      {result.imageUrl ? (
                        // biome-ignore lint/performance/noImgElement: editor MVP, no next/image config yet
                        <img
                          src={result.imageUrl}
                          alt=""
                          style={{
                            width: 34,
                            height: 48,
                            objectFit: "cover",
                            borderRadius: 2,
                            background: "color-mix(in srgb, var(--linen) 6%, transparent)",
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 34,
                            height: 48,
                            borderRadius: 2,
                            border: "1px solid color-mix(in srgb, var(--linen) 12%, transparent)",
                          }}
                        />
                      )}
                      <div className="sb-ed-result-meta">
                        <span>
                          {result.setName} — {result.name}{" "}
                          <span className="sb-ed-num">{result.number}</span> ({result.variant}){" "}
                        </span>
                        <div className="sb-ed-result-actions">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleAddCard(result.id)}
                          >
                            Usar como carta
                          </button>
                          <button
                            type="button"
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
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
