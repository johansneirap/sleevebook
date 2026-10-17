"use client";

import { SELLER_CSS } from "./seller-css";
import { hasContact, useWantList } from "./want-list";
import { buildWantListText, instagramUrl, mailtoUrl, whatsappUrl } from "./want-list-text";

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
        gap: "8px 18px",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{SELLER_CSS}</style>
      {heading ? (
        <p
          className="sb-label"
          style={{ margin: 0, fontSize: 11, color: "var(--smoke)", width: "100%" }}
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
          Instagram
        </a>
      ) : null}
      {contact.email ? (
        <a className="sp-link" href={mailtoUrl(contact.email, subject, text)}>
          Email
        </a>
      ) : null}
    </div>
  );
}
