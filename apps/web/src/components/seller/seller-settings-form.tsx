"use client";

import type { BinderMode, Currency, SellerContact } from "@sleevebook/binder-core";
import { useActionState, useState } from "react";
import { saveSellerSettings } from "../../lib/seller-actions";
import { SETTINGS_IDLE } from "./settings-state";

export interface SellerSettingsFormProps {
  binderId: string;
  mode: BinderMode;
  currency: Currency;
  contact: SellerContact;
}

const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: "usd", label: "USD (dólar)" },
  { value: "clp", label: "CLP (peso chileno)" },
  { value: "eur", label: "EUR (euro)" },
];

export function SellerSettingsForm({ binderId, mode, currency, contact }: SellerSettingsFormProps) {
  const [state, formAction, pending] = useActionState(saveSellerSettings, SETTINGS_IDLE);
  const [draftMode, setDraftMode] = useState<BinderMode>(mode);
  const [draftCurrency, setDraftCurrency] = useState<Currency>(currency);
  const [whatsapp, setWhatsapp] = useState(contact.whatsapp ?? "");
  const [instagram, setInstagram] = useState(contact.instagram ?? "");
  const [email, setEmail] = useState(contact.email ?? "");

  const errors = state.errors;

  return (
    <form action={formAction} className="sb-seller-settings" noValidate>
      <input type="hidden" name="binderId" value={binderId} />

      <fieldset className="sb-seller-fieldset">
        <legend className="sb-field-label">Modo</legend>
        <div className="sb-seller-modes" role="radiogroup" aria-label="Modo del binder">
          <label className="sb-seller-mode">
            <input
              type="radio"
              name="mode"
              value="collection"
              checked={draftMode === "collection"}
              onChange={() => setDraftMode("collection")}
            />
            <span>Colección</span>
          </label>
          <label className="sb-seller-mode">
            <input
              type="radio"
              name="mode"
              value="seller"
              checked={draftMode === "seller"}
              onChange={() => setDraftMode("seller")}
            />
            <span>Venta</span>
          </label>
        </div>
        <p className="sb-seller-note">
          {draftMode === "seller"
            ? "El link público muestra precios, estados y botón de contacto."
            : "El link público no muestra precios ni botón de contacto. Puedes preparar las ventas igual."}
        </p>
        {errors.mode && (
          <p role="alert" className="sb-seller-error">
            {errors.mode}
          </p>
        )}
      </fieldset>

      <div className="sb-seller-grid">
        <label className="sb-field">
          <span className="sb-field-label">Moneda de precios</span>
          <select
            name="currency"
            value={draftCurrency}
            onChange={(event) => setDraftCurrency(event.target.value as Currency)}
            aria-invalid={errors.currency ? true : undefined}
          >
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.currency && (
            <span role="alert" className="sb-seller-error">
              {errors.currency}
            </span>
          )}
        </label>

        <label className="sb-field">
          <span className="sb-field-label">WhatsApp</span>
          <input
            type="text"
            name="whatsapp"
            inputMode="tel"
            placeholder="56912345678"
            autoComplete="off"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            aria-invalid={errors.whatsapp ? true : undefined}
            aria-describedby="seller-whatsapp-help seller-whatsapp-error"
          />
          <span id="seller-whatsapp-help" className="sb-seller-help">
            Código de país y número, sin +. Ej: 56 9 1234 5678 (Chile).
          </span>
          {errors.whatsapp && (
            <span id="seller-whatsapp-error" role="alert" className="sb-seller-error">
              {errors.whatsapp}
            </span>
          )}
        </label>

        <label className="sb-field">
          <span className="sb-field-label">Instagram</span>
          <input
            type="text"
            name="instagram"
            placeholder="tu_usuario"
            autoComplete="off"
            value={instagram}
            onChange={(event) => setInstagram(event.target.value)}
            aria-invalid={errors.instagram ? true : undefined}
            aria-describedby="seller-instagram-error"
          />
          {errors.instagram && (
            <span id="seller-instagram-error" role="alert" className="sb-seller-error">
              {errors.instagram}
            </span>
          )}
        </label>

        <label className="sb-field">
          <span className="sb-field-label">Correo</span>
          <input
            type="email"
            name="email"
            placeholder="tu@correo.com"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="seller-email-error"
          />
          {errors.email && (
            <span id="seller-email-error" role="alert" className="sb-seller-error">
              {errors.email}
            </span>
          )}
        </label>
      </div>

      <div className="sb-seller-actions">
        <button type="submit" className="sb-foil-action" disabled={pending}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>
        {state.status === "saved" && (
          <span role="status" className="sb-seller-saved">
            {state.message}
          </span>
        )}
        {state.status === "error" && state.message && !Object.keys(errors).length && (
          <span role="alert" className="sb-seller-error">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
