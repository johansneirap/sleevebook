"use client";

import { useEffect, useState } from "react";
import { demoImageUrls } from "../../sample-layout";
import { CardBack } from "./card-back";
import { FlipCard } from "./flip-card";
import { HoloCard } from "./holo-card";

const DEMO_WIDTH = 260;
const DEMO_IMAGE_KEY = "base1-4.holo";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function FlippableCardDemo() {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "f" && event.key !== "F") {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      setFlipped((value) => !value);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section
      aria-label="Voltear carta"
      style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <h2>Voltear carta</h2>
      <FlipCard
        width={DEMO_WIDTH}
        flipped={flipped}
        front={
          <HoloCard
            imageUrl={demoImageUrls[DEMO_IMAGE_KEY] ?? null}
            name="Carta de demostración"
            variant="holo"
            width={DEMO_WIDTH}
          />
        }
        back={<CardBack width={DEMO_WIDTH} />}
      />
      <div>
        <button type="button" aria-pressed={flipped} onClick={() => setFlipped((value) => !value)}>
          Voltear carta
        </button>
        <p style={{ opacity: 0.6, fontSize: 12 }}>Atajo: tecla F</p>
      </div>
    </section>
  );
}
