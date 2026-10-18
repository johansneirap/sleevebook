import Link from "next/link";
import { AccountBar } from "../../components/auth/account-bar";
import { BinderCatalogEntry } from "../../components/library/binder-catalog-entry";
import { listBinders } from "../../lib/binders";
import "../../components/library/catalog.css";
import { requireUser } from "../../lib/session";

export default async function BindersPage() {
  const current = await requireUser("/binders");
  const binders = await listBinders(current.id);

  return (
    <main className="sb-catalog-page">
      <AccountBar name={current.name} handle={current.handle} />
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <p className="sb-catalog-eyebrow">
            Colección privada · {binders.length} {binders.length === 1 ? "binder" : "binders"}
          </p>
          <h1 className="sb-catalog-title">Mis binders</h1>
        </div>
        <Link href="/binders/new" className="sb-foil-action">
          + Crear binder
        </Link>
      </header>

      {binders.length === 0 ? (
        <p className="sb-catalog-empty">Todavía no hay binders en la colección.</p>
      ) : (
        <ul className="sb-catalog-list">
          {binders.map((b, index) => (
            <BinderCatalogEntry key={b.id} binder={b} lot={index + 1} />
          ))}
        </ul>
      )}
    </main>
  );
}
