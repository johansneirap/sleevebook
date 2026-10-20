"use client";

import type { Currency } from "@sleevebook/binder-core";
import { useActionState, useState } from "react";
import { saveAccount } from "../../lib/profile-actions";
import { ACCOUNT_IDLE } from "./account-state";
import "./profile.css";

export interface AccountFormProps {
  initial: {
    name: string;
    handle: string;
    bio: string;
    whatsapp: string;
    instagram: string;
    email: string;
    preferredCurrency: Currency;
    isPublic: boolean;
    wishlistPublic: boolean;
    tradesOptIn: boolean;
  };
  /** Public origin without protocol, e.g. "sleevebook.app" ("" when unknown). */
  publicHost: string;
}

const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: "usd", label: "USD (dólar)" },
  { value: "clp", label: "CLP (peso chileno)" },
  { value: "eur", label: "EUR (euro)" },
];

const BIO_LIMIT = 280;

export function AccountForm({ initial, publicHost }: AccountFormProps) {
  const [state, formAction, pending] = useActionState(saveAccount, ACCOUNT_IDLE);
  const [name, setName] = useState(initial.name);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [instagram, setInstagram] = useState(initial.instagram);
  const [email, setEmail] = useState(initial.email);
  const [currency, setCurrency] = useState<Currency>(initial.preferredCurrency);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [wishlistPublic, setWishlistPublic] = useState(initial.wishlistPublic);
  const [tradesOptIn, setTradesOptIn] = useState(initial.tradesOptIn);

  const errors = state.errors;
  const previewHandle = handle.trim().toLowerCase() || "tu-usuario";
  const previewUrl = publicHost ? `${publicHost}/u/${previewHandle}` : `/u/${previewHandle}`;

  return (
    <form action={formAction} className="sb-account-form" noValidate>
      <section className="sb-account-section" aria-labelledby="account-profile-title">
        <h2 id="account-profile-title" className="sb-account-title">
          Perfil
        </h2>
        <div className="sb-account-grid">
          <label className="sb-account-field">
            <span className="sb-account-label">Nombre</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "account-name-error" : undefined}
            />
            {errors.name && (
              <span id="account-name-error" role="alert" className="sb-account-error">
                {errors.name}
              </span>
            )}
          </label>

          <label className="sb-account-field">
            <span className="sb-account-label">Usuario</span>
            <span className="sb-account-handle">
              <span aria-hidden="true">@</span>
              <input
                type="text"
                name="handle"
                autoComplete="off"
                maxLength={24}
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                aria-invalid={errors.handle ? true : undefined}
                aria-describedby="account-handle-help account-handle-error"
              />
            </span>
            <span id="account-handle-help" className="sb-account-help" aria-live="polite">
              Tu perfil: <span className="sb-data">{previewUrl}</span>
            </span>
            {errors.handle && (
              <span id="account-handle-error" role="alert" className="sb-account-error">
                {errors.handle}
              </span>
            )}
          </label>
        </div>

        <label className="sb-account-field">
          <span className="sb-account-label">Bio</span>
          <textarea
            name="bio"
            rows={3}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            aria-invalid={errors.bio ? true : undefined}
            aria-describedby="account-bio-count account-bio-error"
          />
          <span id="account-bio-count" className="sb-account-help sb-data">
            {bio.length}/{BIO_LIMIT}
          </span>
          {errors.bio && (
            <span id="account-bio-error" role="alert" className="sb-account-error">
              {errors.bio}
            </span>
          )}
        </label>
      </section>

      <section className="sb-account-section" aria-labelledby="account-contact-title">
        <h2 id="account-contact-title" className="sb-account-title">
          Contacto
        </h2>
        <p className="sb-account-help">
          Se muestran en tu perfil público y en los intercambios. Todos son opcionales.
        </p>
        <div className="sb-account-grid">
          <label className="sb-account-field">
            <span className="sb-account-label">WhatsApp</span>
            <input
              type="text"
              name="whatsapp"
              inputMode="tel"
              placeholder="56912345678"
              autoComplete="off"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              aria-invalid={errors.whatsapp ? true : undefined}
              aria-describedby="account-whatsapp-help account-whatsapp-error"
            />
            <span id="account-whatsapp-help" className="sb-account-help">
              Código de país y número, sin +. Ej: 56 9 1234 5678 (Chile).
            </span>
            {errors.whatsapp && (
              <span id="account-whatsapp-error" role="alert" className="sb-account-error">
                {errors.whatsapp}
              </span>
            )}
          </label>

          <label className="sb-account-field">
            <span className="sb-account-label">Instagram</span>
            <input
              type="text"
              name="instagram"
              placeholder="tu_usuario"
              autoComplete="off"
              value={instagram}
              onChange={(event) => setInstagram(event.target.value)}
              aria-invalid={errors.instagram ? true : undefined}
              aria-describedby="account-instagram-error"
            />
            {errors.instagram && (
              <span id="account-instagram-error" role="alert" className="sb-account-error">
                {errors.instagram}
              </span>
            )}
          </label>

          <label className="sb-account-field">
            <span className="sb-account-label">Correo</span>
            <input
              type="email"
              name="email"
              placeholder="tu@correo.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby="account-email-error"
            />
            {errors.email && (
              <span id="account-email-error" role="alert" className="sb-account-error">
                {errors.email}
              </span>
            )}
          </label>
        </div>
      </section>

      <section className="sb-account-section" aria-labelledby="account-privacy-title">
        <h2 id="account-privacy-title" className="sb-account-title">
          Privacidad
        </h2>
        <div className="sb-account-toggles">
          <label className="sb-account-toggle">
            <input
              type="checkbox"
              name="isPublic"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
            />
            <span>
              <span className="sb-account-toggle-name">Perfil público</span>
              <span className="sb-account-help">
                Cualquiera con tu enlace ve tu perfil y tus binders publicados. Apagado, tu página
                no se muestra a nadie.
              </span>
            </span>
          </label>

          <label className="sb-account-toggle">
            <input
              type="checkbox"
              name="wishlistPublic"
              checked={wishlistPublic}
              onChange={(event) => setWishlistPublic(event.target.checked)}
            />
            <span>
              <span className="sb-account-toggle-name">Mostrar mi lista de deseos</span>
              <span className="sb-account-help">
                Las cartas que buscas aparecen en tu perfil público.
              </span>
            </span>
          </label>

          <label className="sb-account-toggle">
            <input
              type="checkbox"
              name="tradesOptIn"
              checked={tradesOptIn}
              onChange={(event) => setTradesOptIn(event.target.checked)}
            />
            <span>
              <span className="sb-account-toggle-name">Participar en intercambios</span>
              <span className="sb-account-help">
                Te incluimos cuando se cruzan cartas con otros coleccionistas.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="sb-account-section" aria-labelledby="account-currency-title">
        <h2 id="account-currency-title" className="sb-account-title">
          Moneda
        </h2>
        <label className="sb-account-field sb-account-field-narrow">
          <span className="sb-account-label">Precios de tu lista de deseos e intercambios</span>
          <select
            name="preferredCurrency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            aria-invalid={errors.preferredCurrency ? true : undefined}
          >
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.preferredCurrency && (
            <span role="alert" className="sb-account-error">
              {errors.preferredCurrency}
            </span>
          )}
        </label>
      </section>

      <div className="sb-account-actions">
        <button type="submit" className="sb-account-save" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {state.status === "saved" && (
          <p role="status" className="sb-account-saved">
            {state.message}
          </p>
        )}
        {state.status === "error" && state.message && (
          <p role="alert" className="sb-account-error">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
