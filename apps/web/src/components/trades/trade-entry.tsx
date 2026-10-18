import Link from "next/link";
import type { TradeCard, TradeEntry } from "../../lib/trades";
import { instagramUrl, mailtoUrl, whatsappUrl } from "../seller-public/want-list-text";
import { buildTradeMessage } from "./trade-message";

function priceText(priceUsd: number | null): string {
  return priceUsd === null ? "sin precio" : `$${priceUsd.toFixed(2)} USD`;
}

function CardThumb({ card }: { card: TradeCard }) {
  const title = `${card.name} · ${card.setName} ${card.number}`;
  return (
    <li className="sb-trade-card">
      {card.imageUrl ? (
        // biome-ignore lint/performance/noImgElement: thumbnails are tiny and lazy, no next/image host config for catalog images
        <img
          className="sb-trade-thumb"
          src={card.imageUrl}
          alt={card.name}
          title={title}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="sb-trade-thumb-blank" role="img" aria-label={card.name} title={title} />
      )}
      <figcaption>
        <span className="sb-data">
          {card.setName} · {card.number}
        </span>
        <span className="sb-data">{priceText(card.priceUsd)}</span>
      </figcaption>
    </li>
  );
}

function CardRow({ label, cards }: { label: string; cards: TradeCard[] }) {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className="sb-trade-row">
      <p className="sb-trade-row-label">{label}</p>
      <ul className="sb-trade-cards" aria-label={label}>
        {cards.map((card) => (
          <CardThumb key={card.variantId} card={card} />
        ))}
      </ul>
    </div>
  );
}

function ContactLinks({ entry }: { entry: TradeEntry }) {
  const { contact, theyCanGive, youCanGive } = entry;
  const text = buildTradeMessage({ theyCanGive, youCanGive });
  const subject = "Intercambio de cartas (Sleevebook)";
  if (!contact.whatsapp && !contact.instagram && !contact.email) {
    return null;
  }
  return (
    <nav className="sb-trade-contact" aria-label={`Contacto de @${entry.handle}`}>
      {contact.whatsapp ? (
        <a href={whatsappUrl(contact.whatsapp, text)} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      ) : null}
      {contact.instagram ? (
        <a href={instagramUrl(contact.instagram)} target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
      ) : null}
      {contact.email ? <a href={mailtoUrl(contact.email, subject, text)}>Email</a> : null}
    </nav>
  );
}

/** One person with a match: who they are, what each side can give, how to reach them. */
export function TradeEntryCard({ entry }: { entry: TradeEntry }) {
  const initial = entry.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <li className="sb-trade-entry" data-testid="trade-entry" data-handle={entry.handle}>
      <header className="sb-trade-head">
        {entry.image ? (
          // biome-ignore lint/performance/noImgElement: avatar from the auth provider, tiny, no next/image host config
          <img className="sb-trade-avatar" src={entry.image} alt="" width={44} height={44} />
        ) : (
          <span className="sb-trade-monogram" aria-hidden="true">
            {initial}
          </span>
        )}
        <div className="sb-trade-identity">
          <h2 className="sb-trade-name">{entry.name}</h2>
          <Link href={`/u/${entry.handle}`} className="sb-trade-handle">
            @{entry.handle}
          </Link>
        </div>
        {entry.mutual ? <span className="sb-trade-tag">Intercambio mutuo</span> : null}
      </header>
      <CardRow label="Te puede dar" cards={entry.theyCanGive} />
      <CardRow label="Le sirve de lo tuyo" cards={entry.youCanGive} />
      <ContactLinks entry={entry} />
    </li>
  );
}
