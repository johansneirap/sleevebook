"use client";

import type { ReactNode } from "react";
import { SELLER_CSS } from "./seller-css";
import { hasContact, useWantList } from "./want-list";
import { buildWantListText, instagramUrl, mailtoUrl, whatsappUrl } from "./want-list-text";

// Simple 24px stroke icons, matching the app's icon set.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="sp-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const WhatsAppIcon = () => (
  <Icon>
    <path d="M4 20l1.2-3.6A8 8 0 1 1 8.4 18.8z" />
    <path d="M9 9.5c0 2.5 2.5 5 5 5l1-1.2-1.8-.9-.7.7c-.8-.4-1.6-1.2-2-2l.7-.7-.9-1.8z" />
  </Icon>
);

const InstagramIcon = () => (
  <Icon>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M17.2 6.8h.01" />
  </Icon>
);

const EmailIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3.5 6.5L12 13l8.5-6.5" />
  </Icon>
);

/**
 * WhatsApp / Instagram / email links to the seller, carrying the buyer's
 * current list. Renders nothing when the seller has no contact channel.
 */
export function SellerContactButtons({ heading = false }: { heading?: boolean }) {
  const want = useWantList();
  if (!want || !hasContact(want.contact)) {
    return null;
  }
  const { contact, binderName, currency, items, url } = want;
  const text = buildWantListText({ binderName, url, items, currency });
  const subject = `Lista de cartas — ${binderName}`;

  return (
    <div
      data-testid="seller-contact"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{SELLER_CSS}</style>
      {heading ? (
        <p
          className="sb-label"
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--muted)",
            width: "100%",
          }}
        >
          Contactar al vendedor
        </p>
      ) : null}
      {contact.whatsapp ? (
        <a
          className="sp-link"
          href={whatsappUrl(contact.whatsapp, text)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon />
          WhatsApp
        </a>
      ) : null}
      {contact.instagram ? (
        <a
          className="sp-link"
          href={instagramUrl(contact.instagram)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <InstagramIcon />
          Instagram
        </a>
      ) : null}
      {contact.email ? (
        <a className="sp-link" href={mailtoUrl(contact.email, subject, text)}>
          <EmailIcon />
          Email
        </a>
      ) : null}
    </div>
  );
}
