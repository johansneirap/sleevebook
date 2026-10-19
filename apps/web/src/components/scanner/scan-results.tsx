"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { placeScannedCard, type ScanPlacementResult } from "../../lib/scan-placement-actions";
import type { ScanCandidate, ScanReading, ScanResult } from "../../lib/scan-types";
import { addToWishlist } from "../../lib/wishlist-actions";
import { FINISH_LABEL, SCANNER_COPY, STATUS_COPY } from "./scanner-copy";

export interface BinderOption {
  id: string;
  name: string;
}

/** What the session history records for one scan. */
export interface ScanAction {
  action: string;
  /** The candidate the user acted on, so the history shows the real card. */
  card?: ScanCandidate;
}

interface ScanResultPanelProps {
  result: ScanResult;
  binders: BinderOption[];
  onAction: (action: ScanAction) => void;
  onAgain: () => void;
}

/** "Lucario · 6/130 · Diamond & Pearl" (plus the finish when the model saw one). */
export function readingLine(reading: ScanReading): string {
  const number = reading.number
    ? reading.setTotal
      ? `${reading.number}/${reading.setTotal}`
      : reading.number
    : null;
  const finish = reading.finish ? (FINISH_LABEL[reading.finish] ?? null) : null;
  return [reading.name, number, reading.setName, finish].filter(Boolean).join(" · ");
}

export function ScanResultPanel({ result, binders, onAction, onAgain }: ScanResultPanelProps) {
  if (result.status !== "ok" || !result.reading) {
    const message = result.status === "ok" ? SCANNER_COPY.noMatchTitle : STATUS_COPY[result.status];
    return (
      <section className="sb-scan-panel" aria-labelledby="scan-result-title">
        <p id="scan-result-title" className="sb-scan-error">
          {message}
        </p>
        <button type="button" className="sb-scan-capture" onClick={onAgain}>
          {SCANNER_COPY.again}
        </button>
      </section>
    );
  }

  return (
    <OkResult
      reading={result.reading}
      candidates={result.candidates}
      remainingToday={result.remainingToday}
      binders={binders}
      onAction={onAction}
      onAgain={onAgain}
    />
  );
}

interface OkResultProps {
  reading: ScanReading;
  candidates: ScanCandidate[];
  remainingToday?: number;
  binders: BinderOption[];
  onAction: (action: ScanAction) => void;
  onAgain: () => void;
}

function OkResult({
  reading,
  candidates,
  remainingToday,
  binders,
  onAction,
  onAgain,
}: OkResultProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

  const ranked = useMemo(() => [...candidates].sort((a, b) => b.score - a.score), [candidates]);
  const visible = ranked.filter((candidate) => !dismissed.has(candidate.variantId));
  const line = readingLine(reading);

  return (
    <section className="sb-scan-panel" aria-labelledby="scan-result-title">
      <div style={{ display: "grid", gap: 6 }}>
        <p className="sb-label sb-catalog-eyebrow" style={{ fontSize: 12, color: "var(--smoke)" }}>
          Leímos
        </p>
        <h2 id="scan-result-title" className="sb-scan-reading">
          {line}
        </h2>
        {remainingToday !== undefined && (
          <p className="sb-scan-meta sb-data" style={{ margin: 0 }}>
            Te quedan {remainingToday} escaneos hoy
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p className="sb-scan-error">
            {ranked.length === 0 ? SCANNER_COPY.noMatchTitle : "Ninguna de estas cartas coincide."}
          </p>
          <p className="sb-scan-meta" style={{ margin: 0 }}>
            {SCANNER_COPY.noMatchHint}
          </p>
          <div>
            <Link href="/deseos" className="sb-scan-link">
              {SCANNER_COPY.searchManually}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="sb-scan-candidates" aria-label="Cartas encontradas">
          {visible.map((candidate, index) => (
            <CandidateRow
              key={candidate.variantId}
              candidate={candidate}
              best={index === 0}
              binders={binders}
              onAction={onAction}
              onDismiss={() =>
                setDismissed((previous) => new Set(previous).add(candidate.variantId))
              }
            />
          ))}
        </ul>
      )}

      <div>
        <button type="button" className="sb-scan-upload" onClick={onAgain}>
          {SCANNER_COPY.again}
        </button>
      </div>
    </section>
  );
}

interface CandidateRowProps {
  candidate: ScanCandidate;
  best: boolean;
  binders: BinderOption[];
  onAction: (action: ScanAction) => void;
  onDismiss: () => void;
}

function CandidateRow({ candidate, best, binders, onAction, onDismiss }: CandidateRowProps) {
  const [wishlist, setWishlist] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [placeOpen, setPlaceOpen] = useState(false);
  const [binderId, setBinderId] = useState(binders[0]?.id ?? "");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<Extract<ScanPlacementResult, { status: "placed" }> | null>(
    null,
  );
  const [placeMessage, setPlaceMessage] = useState<string | null>(null);

  async function handleWishlist() {
    setWishlist("saving");
    try {
      await addToWishlist(candidate.variantId);
      setWishlist("done");
      onAction({ action: "Agregada a deseos", card: candidate });
    } catch {
      setWishlist("error");
    }
  }

  async function handlePlace() {
    if (!binderId) {
      return;
    }
    setPlacing(true);
    setPlaceMessage(null);
    try {
      const outcome = await placeScannedCard(binderId, candidate.variantId);
      if (outcome.status === "placed") {
        setPlaced(outcome);
        setPlaceOpen(false);
        onAction({
          action: `En ${outcome.binderName} · ${outcome.pocketCode}`,
          card: candidate,
        });
      } else if (outcome.status === "full") {
        setPlaceMessage(`«${outcome.binderName}» no tiene huecos libres.`);
      } else {
        setPlaceMessage(outcome.message);
      }
    } catch {
      setPlaceMessage("No pudimos colocar la carta. Intenta de nuevo.");
    } finally {
      setPlacing(false);
    }
  }

  const number = candidate.number ? ` · ${candidate.number}` : "";

  return (
    <li className="sb-scan-candidate" data-best={best ? "true" : "false"}>
      {candidate.imageUrl ? (
        // biome-ignore lint/performance/noImgElement: catalog card images come from an external CDN
        <img
          src={candidate.imageUrl}
          alt=""
          width={72}
          height={100}
          loading="lazy"
          style={{ width: 72, height: "auto", borderRadius: 3, alignSelf: "start" }}
        />
      ) : (
        <span
          aria-hidden
          style={{ width: 72, height: 100, borderRadius: 3, background: "var(--leather)" }}
        />
      )}

      <div style={{ minWidth: 0 }}>
        {best && (
          <p className="sb-label" style={{ margin: "0 0 4px", fontSize: 11, color: "var(--foil)" }}>
            {SCANNER_COPY.bestMatch}
          </p>
        )}
        <p className="sb-scan-candidate-name">{candidate.name}</p>
        <p className="sb-scan-meta sb-data">
          {candidate.setName}
          {number}
        </p>
        {candidate.variant && <p className="sb-scan-meta">{candidate.variant}</p>}

        {placed ? (
          <p className="sb-scan-meta" style={{ margin: "12px 0 0", color: "var(--linen)" }}>
            Colocada en {placed.pocketCode} de «{placed.binderName}».{" "}
            <Link
              href={`/binders/${placed.binderId}?spread=${placed.spread}`}
              className="sb-scan-link"
            >
              Ver en el binder
            </Link>
          </p>
        ) : (
          <div className="sb-scan-candidate-actions">
            <button
              type="button"
              className="sb-scan-upload"
              onClick={handleWishlist}
              disabled={wishlist === "saving" || wishlist === "done"}
            >
              {wishlist === "done"
                ? SCANNER_COPY.wishlistDone
                : wishlist === "saving"
                  ? SCANNER_COPY.wishlistSaving
                  : SCANNER_COPY.wishlistAdd}
            </button>
            {binders.length > 0 ? (
              <button
                type="button"
                className="sb-scan-text-button"
                aria-expanded={placeOpen}
                onClick={() => setPlaceOpen((open) => !open)}
              >
                {SCANNER_COPY.binderAdd}
              </button>
            ) : (
              <Link href="/binders/new" className="sb-scan-link">
                {SCANNER_COPY.createBinder}
              </Link>
            )}
            <button type="button" className="sb-scan-text-button" onClick={onDismiss}>
              {SCANNER_COPY.notThis}
            </button>
          </div>
        )}

        {wishlist === "error" && (
          <p className="sb-scan-meta" role="alert" style={{ color: "var(--foil)" }}>
            No pudimos agregarla a tus deseos. Intenta de nuevo.
          </p>
        )}

        {placeOpen && !placed && binders.length > 0 && (
          <div className="sb-scan-place" style={{ marginTop: 12 }}>
            <label style={{ flex: "1 1 180px", display: "grid", gap: 4 }}>
              <span className="sb-scan-meta">Binder</span>
              <select value={binderId} onChange={(event) => setBinderId(event.target.value)}>
                {binders.map((binder) => (
                  <option key={binder.id} value={binder.id}>
                    {binder.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="sb-scan-upload"
              onClick={handlePlace}
              disabled={placing || !binderId}
            >
              {placing ? SCANNER_COPY.binderPlacing : SCANNER_COPY.binderPlace}
            </button>
          </div>
        )}

        {placeMessage && (
          <p
            className="sb-scan-meta"
            role="alert"
            style={{ margin: "10px 0 0", color: "var(--foil)" }}
          >
            {placeMessage}
          </p>
        )}
      </div>
    </li>
  );
}
