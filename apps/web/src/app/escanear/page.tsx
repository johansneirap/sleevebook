import Link from "next/link";
import { Scanner } from "../../components/scanner/scanner";
import { SiteNav } from "../../components/site/site-nav";
import "../../components/library/catalog.css";
import { listBinders } from "../../lib/binders";
import { requireUser } from "../../lib/session";

export default async function ScanPage() {
  const viewer = await requireUser("/escanear");
  const binders = await listBinders(viewer.id);

  return (
    <main className="sb-scan-page">
      <SiteNav current="/escanear" />

      <header>
        <p className="sb-catalog-eyebrow">Escaneo con cámara</p>
        <h1 className="sb-catalog-title">Escanear carta</h1>
        <p
          style={{
            margin: "12px 0 0",
            maxWidth: 560,
            fontFamily: "var(--font-ui)",
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--smoke)",
          }}
        >
          Apunta a la carta y la leemos. Tú eliges cuál es antes de guardar nada.{" "}
          <Link href="/deseos" style={{ color: "var(--linen)" }}>
            Buscar a mano
          </Link>
        </p>
      </header>

      <Scanner binders={binders.map((binder) => ({ id: binder.id, name: binder.name }))} />
    </main>
  );
}
