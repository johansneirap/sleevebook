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
import { formatPocketCode } from "@sleevebook/binder-core";
import { useRef, useState, useTransition } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { applyPocketChanges, type PocketChange, type PocketValue } from "../../lib/pocket-actions";
import { searchCardVariants } from "../../lib/search";

interface BinderEditorProps {
  binderId: string;
  faces: SheetFace[];
  format: Format;
  pockets: Layout["pockets"];
  displays: Record<string, VariantDisplay>;
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

export function BinderEditor({ binderId, faces, format, pockets, displays }: BinderEditorProps) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantDisplay[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={handleUndo} disabled={undoStack.length === 0 || isPending}>
          Deshacer
        </button>
        <button type="button" onClick={handleRedo} disabled={redoStack.length === 0 || isPending}>
          Rehacer
        </button>
      </div>

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
