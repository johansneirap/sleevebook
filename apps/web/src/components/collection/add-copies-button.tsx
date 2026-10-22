"use client";

import { useState } from "react";
import { CopyDialog } from "./copy-dialog";

/** Primary "+ Agregar copias" button and the add dialog it opens. */
export function AddCopiesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="sb-foil-action" onClick={() => setOpen(true)}>
        + Agregar copias
      </button>
      <CopyDialog mode="add" open={open} onClose={() => setOpen(false)} />
    </>
  );
}
