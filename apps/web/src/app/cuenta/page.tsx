import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "../../components/profile/account-form";
import { SiteNav } from "../../components/site/site-nav";
import "../../components/library/catalog.css";
import { getAccountSettings } from "../../lib/profile";
import { requireUser } from "../../lib/session";
import { getSiteUrl } from "../../lib/share";

export const metadata: Metadata = { title: "Cuenta — Sleevebook" };

/** The site's host without protocol, for the public URL preview ("" when unknown). */
function publicHostOf(siteUrl: string): string {
  try {
    return new URL(siteUrl).host;
  } catch {
    return "";
  }
}

export default async function AccountPage() {
  const current = await requireUser("/cuenta");
  const account = await getAccountSettings(current.id);
  if (!account) {
    throw new Error("Cuenta no encontrada");
  }
  const { profile: saved } = account;

  return (
    <main className="sb-catalog-page">
      <SiteNav current="/cuenta" />
      <header>
        <p className="sb-catalog-eyebrow">Tu cuenta</p>
        <h1 className="sb-catalog-title">{account.name}</h1>
        {saved.isPublic && (
          <p style={{ margin: "12px 0 0" }}>
            <Link href={`/u/${account.handle}`} className="sb-account-link">
              Ver mi perfil público
            </Link>
          </p>
        )}
      </header>

      <AccountForm
        publicHost={publicHostOf(getSiteUrl())}
        initial={{
          name: account.name,
          handle: account.handle,
          bio: saved.bio,
          whatsapp: saved.contact.whatsapp ?? "",
          instagram: saved.contact.instagram ?? "",
          email: saved.contact.email ?? "",
          preferredCurrency: account.preferredCurrency,
          isPublic: saved.isPublic,
          wishlistPublic: saved.wishlistPublic,
          tradesOptIn: saved.tradesOptIn,
        }}
      />
    </main>
  );
}
