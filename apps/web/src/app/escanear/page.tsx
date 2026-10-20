import Link from "next/link";
import { Scanner } from "../../components/scanner/scanner";
import { SiteNav } from "../../components/site/site-nav";
import { listBinders } from "../../lib/binders";
import { requireUser } from "../../lib/session";

export default async function ScanPage() {
  const viewer = await requireUser("/escanear");
  const binders = await listBinders(viewer.id);

  return (
    <>
      <SiteNav current="/escanear" />
      <main className="sb-scan-page">
        <header className="sb-scan-head">
          <h1 className="sb-scan-title">Escanear carta</h1>
          <p className="sb-scan-lead">
            Apunta a la carta y la leemos. Tú eliges cuál es antes de guardar nada.{" "}
            <Link href="/deseos" className="sb-scan-link">
              Buscar a mano
            </Link>
          </p>
        </header>

        <Scanner binders={binders.map((binder) => ({ id: binder.id, name: binder.name }))} />
      </main>
    </>
  );
}
