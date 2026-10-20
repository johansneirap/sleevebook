import type { SellerContact } from "@sleevebook/binder-core";
import Link from "next/link";
import type { GoalProgress } from "../../lib/goals";
import type { PublicWishlistItem } from "../../lib/profile";
import "./profile.css";

export interface PublicBinderCard {
  id: string;
  name: string;
  slug: string;
  progress: GoalProgress | null;
}

/** Initials for the monogram: "Johans Neira" -> "JN". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word.charAt(0));
  return letters.join("").toUpperCase() || "?";
}

export function ProfileHeader({
  name,
  handle,
  image,
  bio,
  contact,
}: {
  name: string;
  handle: string;
  image: string | null;
  bio: string;
  contact: SellerContact;
}) {
  const whatsappDigits = contact.whatsapp;
  const instagram = contact.instagram;
  const email = contact.email;

  return (
    <header className="sb-public-header">
      {image ? (
        // biome-ignore lint/performance/noImgElement: avatars come from the auth provider, not optimized
        <img src={image} alt="" className="sb-public-avatar" referrerPolicy="no-referrer" />
      ) : (
        <span className="sb-public-monogram" aria-hidden="true">
          {initialsOf(name)}
        </span>
      )}

      <div className="sb-public-identity">
        <h1 className="sb-public-name">{name}</h1>
        <p className="sb-public-handle">@{handle}</p>
        {bio && <p className="sb-public-bio">{bio}</p>}
        {(whatsappDigits || instagram || email) && (
          <nav className="sb-public-contact" aria-label="Contacto">
            {whatsappDigits && (
              <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            )}
            {instagram && (
              <a
                href={`https://instagram.com/${instagram}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            )}
            {email && <a href={`mailto:${email}`}>Correo</a>}
          </nav>
        )}
      </div>
    </header>
  );
}

export function PublicBinders({ binders }: { binders: PublicBinderCard[] }) {
  return (
    <section className="sb-public-section" aria-labelledby="public-binders-title">
      <h2 id="public-binders-title" className="sb-public-section-title">
        Binders
      </h2>
      {binders.length === 0 ? (
        <p className="sb-public-empty">Todavía no hay binders publicados.</p>
      ) : (
        <ul className="sb-public-grid">
          {binders.map((binder) => (
            <li key={binder.id} className="sb-public-card">
              <Link href={`/s/${binder.slug}`}>
                {/* biome-ignore lint/performance/noImgElement: OG images are generated per request */}
                <img
                  src={`/s/${binder.slug}/opengraph-image`}
                  alt=""
                  width={1200}
                  height={630}
                  loading="lazy"
                  className="sb-public-card-image"
                />
                <span className="sb-public-card-name">{binder.name}</span>
              </Link>
              {binder.progress && (
                <p className="sb-public-card-meta">
                  <span className="sb-data">
                    {binder.progress.owned}/{binder.progress.total}
                  </span>{" "}
                  · {binder.progress.percentage}%
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PublicWishlist({ items }: { items: PublicWishlistItem[] }) {
  return (
    <section className="sb-public-section" aria-labelledby="public-wishlist-title">
      <h2 id="public-wishlist-title" className="sb-public-section-title">
        Busca
      </h2>
      {items.length === 0 ? (
        <p className="sb-public-empty">Todavía no hay cartas en su lista de deseos.</p>
      ) : (
        <ul className="sb-public-strip">
          {items.map((item) => (
            <li key={item.id} className="sb-public-wish">
              {item.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: card images come from external catalogs
                <img src={item.imageUrl} alt="" loading="lazy" className="sb-public-wish-image" />
              ) : (
                <span className="sb-public-wish-image" aria-hidden="true" />
              )}
              <span className="sb-public-wish-name">{item.name}</span>
              <p className="sb-public-card-meta">
                {item.setName} · <span className="sb-data">{item.number}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
