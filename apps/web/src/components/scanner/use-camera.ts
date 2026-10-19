"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

export type CameraErrorReason = "insecure" | "denied" | "missing" | "unknown";

export type CameraState =
  | { kind: "starting" }
  | { kind: "live" }
  | { kind: "paused" } // tab hidden: the stream is released
  | { kind: "error"; reason: CameraErrorReason };

/**
 * Owns the camera stream for the scanner. The stream starts on mount, is
 * released when the tab is hidden or the component unmounts, and restarts
 * when the tab becomes visible again. Results do not stop it: the video element
 * stays mounted, so "Escanear otra" resumes instantly.
 */
export function useCamera(videoRef: RefObject<HTMLVideoElement | null>): {
  state: CameraState;
  retry: () => void;
} {
  const [state, setState] = useState<CameraState>({ kind: "starting" });
  const streamRef = useRef<MediaStream | null>(null);
  // Bumped on every start/stop so a slow getUserMedia cannot resurrect a stream.
  const generationRef = useRef(0);
  const wantedRef = useRef(false);

  const release = useCallback(() => {
    generationRef.current += 1;
    if (streamRef.current) {
      stopTracks(streamRef.current);
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoRef]);

  const start = useCallback(async () => {
    wantedRef.current = true;
    release();
    const generation = generationRef.current;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState({ kind: "error", reason: "insecure" });
      return;
    }
    setState({ kind: "starting" });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
    } catch (error) {
      if (generation !== generationRef.current) {
        return;
      }
      setState({ kind: "error", reason: reasonFor(error) });
      return;
    }

    if (generation !== generationRef.current || !wantedRef.current) {
      stopTracks(stream);
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay can be refused; the user's tap on "Capturar" still works.
      }
    }
    if (generation === generationRef.current) {
      setState({ kind: "live" });
    }
  }, [release, videoRef]);

  useEffect(() => {
    void start();

    const onVisibilityChange = () => {
      if (document.hidden) {
        release();
        setState({ kind: "paused" });
      } else if (wantedRef.current) {
        void start();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      wantedRef.current = false;
      release();
    };
  }, [start, release]);

  return { state, retry: () => void start() };
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function reasonFor(error: unknown): CameraErrorReason {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "denied";
  }
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    name === "DevicesNotFoundError"
  ) {
    return "missing";
  }
  return "unknown";
}
