"use client";

import { useEffect, useRef, useState } from "react";
import { scanCard } from "../../lib/scan-actions";
import type { ScanResult } from "../../lib/scan-types";
import { CameraView } from "./camera-view";
import { captureGuidedFrame, encodeUploadedPhoto } from "./capture";
import { type BinderOption, readingLine, type ScanAction, ScanResultPanel } from "./scan-results";
import { SCANNER_COPY } from "./scanner-copy";
import { SCANNER_CSS } from "./scanner-styles";
import { useCamera } from "./use-camera";

type Phase = "camera" | "reading" | "result";

interface Outcome {
  scanId: number;
  result: ScanResult;
}

interface HistoryEntry {
  id: number;
  name: string;
  meta: string;
  action: string;
}

interface ScannerProps {
  binders: BinderOption[];
}

/** The /escanear screen: camera or photo in, reading and candidates out. */
export function Scanner({ binders }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const { state: camera, retry } = useCamera(videoRef);

  const [phase, setPhase] = useState<Phase>("camera");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const scanCounter = useRef(0);
  const busy = useRef(false);

  // Back on the camera after results: the element may have been hidden.
  useEffect(() => {
    if (phase === "camera" && videoRef.current?.paused && camera.kind === "live") {
      void videoRef.current.play().catch(() => undefined);
    }
  }, [phase, camera.kind]);

  async function send(blob: Blob) {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setNotice(null);
    setPhase("reading");

    const formData = new FormData();
    formData.append("image", blob, "carta.jpg");

    let result: ScanResult;
    try {
      result = await scanCard(formData);
    } catch {
      result = { status: "error", candidates: [] };
    }
    busy.current = false;

    const scanId = ++scanCounter.current;
    setOutcome({ scanId, result });
    setPhase("result");

    if (result.status === "ok" && result.reading) {
      const reading = result.reading;
      const number = reading.number
        ? `${reading.number}${reading.setTotal ? `/${reading.setTotal}` : ""}`
        : "";
      const meta = [number, reading.setName].filter(Boolean).join(" · ");
      setHistory((previous) => [
        {
          id: scanId,
          name: reading.name,
          meta: meta || readingLine(reading),
          action: result.candidates.length === 0 ? "Sin coincidencia en el catálogo" : "Leída",
        },
        ...previous,
      ]);
    }
  }

  async function handleCapture() {
    const video = videoRef.current;
    const guide = guideRef.current;
    if (!video || !guide || camera.kind !== "live") {
      setNotice(SCANNER_COPY.notReady);
      return;
    }
    setPhase("reading");
    const blob = await captureGuidedFrame(video, guide);
    if (!blob) {
      setPhase("camera");
      setNotice(SCANNER_COPY.captureFailed);
      return;
    }
    await send(blob);
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setNotice(SCANNER_COPY.unreadable);
      return;
    }
    setPhase("reading");
    const blob = await encodeUploadedPhoto(file);
    if (!blob) {
      setPhase("camera");
      setNotice(SCANNER_COPY.unreadable);
      return;
    }
    await send(blob);
  }

  function handleAgain() {
    setOutcome(null);
    setNotice(null);
    setPhase("camera");
  }

  function handleAction(scanId: number, action: ScanAction) {
    setHistory((previous) =>
      previous.map((entry) => {
        if (entry.id !== scanId) {
          return entry;
        }
        const card = action.card;
        return {
          ...entry,
          action: action.action,
          name: card?.name ?? entry.name,
          meta: card ? [card.number, card.setName].filter(Boolean).join(" · ") : entry.meta,
        };
      }),
    );
  }

  return (
    <>
      <style>{SCANNER_CSS}</style>
      <div className="sb-scan-layout" data-phase={phase}>
        <CameraView
          videoRef={videoRef}
          guideRef={guideRef}
          camera={camera}
          busy={phase === "reading"}
          onCapture={() => void handleCapture()}
          onFile={(file) => void handleFile(file)}
          onRetry={retry}
        />

        <div className="sb-scan-side">
          {notice && (
            <p className="sb-scan-error" role="alert" data-tone="warn">
              {notice}
            </p>
          )}

          {phase === "reading" && (
            <section className="sb-scan-panel" aria-live="polite">
              <p className="sb-scan-error">{SCANNER_COPY.reading}</p>
              <div className="sb-scan-progress" aria-hidden />
            </section>
          )}

          {phase === "result" && outcome && (
            <ScanResultPanel
              key={outcome.scanId}
              result={outcome.result}
              binders={binders}
              onAction={(action) => handleAction(outcome.scanId, action)}
              onAgain={handleAgain}
            />
          )}

          {phase === "camera" && (
            <section className="sb-scan-panel" aria-labelledby="scan-tips-title">
              <h2 id="scan-tips-title" className="sb-catalog-eyebrow">
                {SCANNER_COPY.tipsTitle}
              </h2>
              <ul className="sb-scan-tips">
                {SCANNER_COPY.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section aria-labelledby="scan-history-title" style={{ display: "grid", gap: 12 }}>
              <h2 id="scan-history-title" className="sb-catalog-eyebrow">
                {SCANNER_COPY.historyTitle}
              </h2>
              <ul className="sb-scan-history">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.name}</span>
                    {entry.meta && <span className="sb-scan-meta sb-data">{entry.meta}</span>}
                    <span className="sb-scan-meta" style={{ color: "var(--foil-dim)" }}>
                      {entry.action}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
