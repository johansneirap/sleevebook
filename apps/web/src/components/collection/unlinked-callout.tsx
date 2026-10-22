"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCopiesFromBinders } from "../../lib/collection-actions";

/** Creates an EN / NM copy for every binder pocket that has none yet. */
export function CreateCopiesButton({
  className = "sb-btn sb-btn--secondary",
}: {
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      try {
        const created = await createCopiesFromBinders();
        setMessage(
          created === 0
            ? "No había cartas sin copia en tus binders."
            : `Creamos ${created} ${created === 1 ? "copia" : "copias"} en Inglés y Casi nueva (NM). Puedes editarlas.`,
        );
        router.refresh();
      } catch {
        setMessage("No pudimos crear las copias. Intenta de nuevo.");
      }
    });
  }

  return (
    <span className="sb-col-create">
      <button type="button" className={className} onClick={handleClick} disabled={pending}>
        {pending ? "Creando copias…" : "Crear copias desde mis binders"}
      </button>
      {message ? (
        <span role="status" className="sb-col-create-message">
          {message}
        </span>
      ) : null}
    </span>
  );
}

export function UnlinkedCallout({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return (
    <section className="sb-col-callout" aria-label="Cartas sin copia registrada">
      <p className="sb-col-callout-text">
        Tienes {count} {count === 1 ? "carta" : "cartas"} en tus binders sin copia registrada.
      </p>
      <p className="sb-col-callout-hint">
        Las creamos como Inglés y Casi nueva (NM). Después puedes editar idioma, condición y gradeo.
      </p>
      <CreateCopiesButton className="sb-btn sb-btn--primary" />
    </section>
  );
}
