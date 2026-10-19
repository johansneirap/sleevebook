"use client";

import type { ChangeEvent, RefObject } from "react";
import { CAMERA_ERROR_COPY, SCANNER_COPY } from "./scanner-copy";
import type { CameraState } from "./use-camera";

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  guideRef: RefObject<HTMLDivElement | null>;
  camera: CameraState;
  busy: boolean;
  onCapture: () => void;
  onFile: (file: File) => void;
  onRetry: () => void;
}

const CORNERS = ["tl", "tr", "bl", "br"] as const;

/** Live camera with the card guide, the capture button and the upload alternative. */
export function CameraView({
  videoRef,
  guideRef,
  camera,
  busy,
  onCapture,
  onFile,
  onRetry,
}: CameraViewProps) {
  const live = camera.kind === "live";
  const failed = camera.kind === "error";

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same photo again still fires onChange.
    event.target.value = "";
    if (file) {
      onFile(file);
    }
  }

  let caption: string | null = null;
  if (camera.kind === "starting") {
    caption = "Abriendo la cámara…";
  } else if (camera.kind === "paused") {
    caption = "Cámara en pausa";
  } else if (live) {
    caption = SCANNER_COPY.guideHint;
  }

  return (
    <div className="sb-scan-camera" style={{ display: "grid", gap: 0 }}>
      <div className="sb-scan-stage">
        <video
          ref={videoRef}
          className="sb-scan-video"
          autoPlay
          muted
          playsInline
          aria-label="Vista de la cámara"
          hidden={!live}
        />

        {live && (
          <div className="sb-scan-dim" aria-hidden>
            <div className="sb-scan-guide" ref={guideRef}>
              {CORNERS.map((pos) => (
                <span key={pos} className="sb-scan-corner" data-pos={pos} />
              ))}
            </div>
          </div>
        )}

        {caption && live && <p className="sb-scan-status">{caption}</p>}

        {!live && !failed && (
          <div className="sb-scan-centered">
            <p>{caption ?? "Abriendo la cámara…"}</p>
          </div>
        )}

        {failed && (
          <div className="sb-scan-centered" role="status">
            <p>{CAMERA_ERROR_COPY[camera.reason]}</p>
            {camera.reason !== "insecure" && (
              <button type="button" className="sb-scan-upload" onClick={onRetry}>
                Reintentar cámara
              </button>
            )}
          </div>
        )}
      </div>

      <div className="sb-scan-actions">
        <button
          type="button"
          className="sb-scan-capture"
          onClick={onCapture}
          disabled={!live || busy}
        >
          {SCANNER_COPY.capture}
        </button>
        <label
          className={`sb-scan-upload${failed ? "" : " sb-scan-upload-prominent"}`}
          style={{ justifySelf: "stretch" }}
        >
          {SCANNER_COPY.upload}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={busy}
          />
        </label>
        <p className="sb-scan-help">{SCANNER_COPY.cameraHelp}</p>
      </div>
    </div>
  );
}
