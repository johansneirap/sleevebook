"use client";

import { deleteBinder } from "../../lib/binder-actions";

export function DeleteBinderForm({ binderId }: { binderId: string }) {
  return (
    <form
      action={deleteBinder}
      onSubmit={(event) => {
        if (!window.confirm("¿Eliminar este binder? No se puede deshacer.")) {
          event.preventDefault();
        }
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="binderId" value={binderId} />
      <button type="submit" className="sb-quiet-button">
        Eliminar
      </button>
    </form>
  );
}
