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
import { computeBinderValueUsd, formatPocketCode } from "@sleevebook/binder-core";
import { useRef, useState, useTransition } from "react";
import type { VariantDisplay } from "../../lib/binders";
import {
  computeImportLayout,
  type ImportDestination,
  type ImportFormat,
  type ImportMode,
  type ImportPreview,
  previewImport,
} from "../../lib/import-actions";
import { applyPocketChanges, type PocketChange, type PocketValue } from "../../lib/pocket-actions";
import { searchCardVariants } from "../../lib/search";
import {
  computeSortedLayout,
  type GroupField,
  type SortableField,
  type SortCriterion,
} from "../../lib/sort-actions";

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

interface BinderEditorProps {
  binderId: string;
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  displays: Record<string, VariantDisplay>;
  prices: Record<string, number>;
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

function Pocket({
  code,
  content,
  display,
  isSelected,
  onSelect,
}: {
  code: string;
  content: PocketValue | undefined;
  display: VariantDisplay | undefined;
  isSelected: boolean;
  onSelect: (code: string, additive: boolean) => void;
}) {
  const hasContent = !!content && content.kind !== "empty";
  // Not disabling useDraggable for empty pockets on purpose: dnd-kit marks a
  // disabled draggable aria-disabled, which also blocks Playwright's (and a
  // screen reader's) click on it. handleDragEnd already ignores drags that
  // start from an empty pocket, so there's nothing to additionally disable.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: code });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: code });

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
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? "#06c" : isOver ? "#0a0" : "#ccc",
        borderStyle: content?.kind === "placeholder" ? "dashed" : "solid",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        padding: 4,
        background: isSelected ? "#eef6ff" : "white",
        cursor: hasContent ? "grab" : "pointer",
        opacity: isDragging ? 0.3 : hasContent ? 1 : 0.4,
        overflow: "hidden",
      }}
    >
      {content?.kind === "card" && content.count && content.count > 1 && (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            background: "#06c",
            color: "white",
            borderRadius: 4,
            padding: "0 4px",
            fontSize: 10,
          }}
        >
          ×{content.count}
        </span>
      )}
      {content?.kind === "card" && display?.imageUrl ? (
        // biome-ignore lint/performance/noImgElement: editor MVP, no next/image config yet
        <img
          src={display.imageUrl}
          alt={display.name}
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      ) : display ? (
        <span>
          {display.name} {display.number}
        </span>
      ) : (
        <span>{code}</span>
      )}
    </button>
  );
}

export function BinderEditor({
  binderId,
  faces,
  format,
  pockets,
  displays,
  prices,
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

  function getContent(code: string): PocketValue {
    return pockets[code] ?? EMPTY_POCKET;
  }

  function runChanges(changes: PocketChange[]) {
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
    if (fromContent.kind === "empty") {
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
    if (changes.length > 0) {
      recordAndRun(changes);
    }
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
  const totalValueUsd = computeBinderValueUsd(pockets, prices);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button type="button" onClick={handleUndo} disabled={undoStack.length === 0 || isPending}>
          Deshacer
        </button>
        <button type="button" onClick={handleRedo} disabled={redoStack.length === 0 || isPending}>
          Rehacer
        </button>
        {totalValueUsd > 0 && <span>Valor total del binder: ${totalValueUsd.toFixed(2)} USD</span>}
      </div>

      <details style={{ marginBottom: 16, maxWidth: 420 }}>
        <summary>Reordenar binder</summary>
        <div style={{ marginTop: 8 }}>
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

          {sortError && <p style={{ color: "#c00" }}>{sortError}</p>}

          <button type="button" onClick={handleApplySort} disabled={isSorting || isPending}>
            Aplicar orden
          </button>
        </div>
      </details>

      <details style={{ marginBottom: 16, maxWidth: 480 }}>
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
            style={{ width: "100%", marginTop: 4, fontFamily: "monospace", fontSize: 12 }}
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
                {importPreview.lines.filter((line) => line.status === "resolved").length} resueltas,{" "}
                {importPreview.lines.filter((line) => line.status === "ambiguous").length} ambiguas,{" "}
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
                    <span style={{ fontFamily: "monospace" }}>×{line.quantity}</span>
                    {line.status === "not-found" ? (
                      <span style={{ color: "#c00" }}>
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

              {importError && <p style={{ color: "#c00" }}>{importError}</p>}

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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {faces.map((face) => (
            <section key={`${face.sheet}-${face.side}`}>
              <h2 style={{ fontSize: 14, fontWeight: "normal" }}>
                Hoja {face.sheet} · {face.side === "F" ? "Frente" : "Reverso"}
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${format.cols}, 1fr)`,
                  gap: 6,
                  width: 320,
                }}
              >
                {Array.from({ length: format.rows * format.cols }, (_, i) => {
                  const code = formatPocketCode({
                    sheet: face.sheet,
                    side: face.side,
                    index: i + 1,
                  });
                  const content = pockets[code];
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
                      onSelect={handleSelect}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </DndContext>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #ccc",
          borderRadius: 4,
          padding: 12,
          maxWidth: 420,
        }}
      >
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
              {isSearching && <p>Buscando...</p>}
              <ul style={{ listStyle: "none", padding: 0 }}>
                {results.map((result) => (
                  <li key={result.id} style={{ marginTop: 4 }}>
                    {result.setName} — {result.name} {result.number} ({result.variant}){" "}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        assignSingle({ kind: "card", variant: result.id, instance: null })
                      }
                    >
                      Usar como carta
                    </button>{" "}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        assignSingle({ kind: "placeholder", variant: result.id, style: "ficha" })
                      }
                    >
                      Usar como placeholder
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
