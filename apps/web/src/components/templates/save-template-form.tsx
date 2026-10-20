"use client";

import { useActionState } from "react";
import { type SaveTemplateState, saveAsTemplate } from "../../lib/template-actions";

const IDLE: SaveTemplateState = { errors: {} };

interface SaveTemplateFormProps {
  binderId: string;
  defaultName: string;
}

export function SaveTemplateForm({ binderId, defaultName }: SaveTemplateFormProps) {
  const [state, formAction, pending] = useActionState(saveAsTemplate, IDLE);
  const errors = state.errors;

  return (
    <form action={formAction} className="sb-tpl-form" noValidate>
      <input type="hidden" name="binderId" value={binderId} />

      <label className="sb-field">
        <span className="sb-field-label">Nombre</span>
        <input
          type="text"
          name="name"
          defaultValue={defaultName}
          maxLength={60}
          required
          aria-invalid={errors.name ? true : undefined}
        />
        {errors.name && (
          <span role="alert" className="sb-tpl-error">
            {errors.name}
          </span>
        )}
      </label>

      <label className="sb-field">
        <span className="sb-field-label">Descripción (opcional)</span>
        <textarea
          name="description"
          rows={3}
          maxLength={280}
          aria-invalid={errors.description ? true : undefined}
        />
        {errors.description && (
          <span role="alert" className="sb-tpl-error">
            {errors.description}
          </span>
        )}
      </label>

      <fieldset className="sb-tpl-choice">
        <legend className="sb-field-label">Visibilidad</legend>
        <label>
          <input type="radio" name="visibility" value="public" defaultChecked />
          <span>Pública</span>
          <small>
            Aparece en /plantillas con tu @usuario. Cualquiera puede usarla para crear su propio
            binder.
          </small>
        </label>
        <label>
          <input type="radio" name="visibility" value="private" />
          <span>Privada</span>
          <small>Solo tú la ves y la usas. No aparece en la galería.</small>
        </label>
        {errors.visibility && (
          <p role="alert" className="sb-tpl-error">
            {errors.visibility}
          </p>
        )}
      </fieldset>

      {state.message && (
        <p role="alert" className="sb-tpl-error">
          {state.message}
        </p>
      )}

      <div>
        <button type="submit" className="sb-tpl-primary" disabled={pending}>
          Guardar como plantilla
        </button>
      </div>
    </form>
  );
}
