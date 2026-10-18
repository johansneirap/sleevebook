import Link from "next/link";
import { SiteNav } from "../../components/site/site-nav";
import { TradeEntryCard } from "../../components/trades/trade-entry";
import "../../components/library/catalog.css";
import "../../components/trades/trades.css";
import { requireUser } from "../../lib/session";
import { loadTradeMatches } from "../../lib/trades";
import { getViewerPriceFormatter } from "../../lib/viewer-money";

export default async function IntercambiosPage() {
  const viewer = await requireUser("/intercambios");
  const data = await loadTradeMatches(viewer.id);

  if (!data.optedIn) {
    return (
      <main className="sb-catalog-page">
        <SiteNav current="/intercambios" />
        <header>
          <p className="sb-catalog-eyebrow">Coincidencias de intercambio</p>
          <h1 className="sb-catalog-title">Intercambios</h1>
        </header>
        <p className="sb-trade-empty">Tus intercambios están desactivados.</p>
        <p className="sb-trade-intro">
          Mientras estén desactivados no cruzamos tus cartas con nadie y no apareces en las
          coincidencias de otros coleccionistas. Puedes volver a activarlos en tu cuenta.
        </p>
        <p style={{ margin: "28px 0 0" }}>
          <Link href="/cuenta" className="sb-foil-action">
            Ir a mi cuenta
          </Link>
        </p>
      </main>
    );
  }

  const { formatUsd } = await getViewerPriceFormatter(viewer.id);
  const count = data.entries.length;
  return (
    <main className="sb-catalog-page">
      <SiteNav current="/intercambios" />
      <header>
        <p className="sb-catalog-eyebrow">
          Coincidencias de intercambio · {count} {count === 1 ? "coleccionista" : "coleccionistas"}
        </p>
        <h1 className="sb-catalog-title">Tengo repetida lo que te falta</h1>
        <p className="sb-trade-intro">
          Cruzamos tu lista de deseos y tus cartas repetidas con las de otros coleccionistas que
          también participan. Una carta repetida es la que tienes de más: en tu colección siempre
          queda una copia, y las cartas a la venta en tus binders de vendedor cuentan completas.
          Solo ves coincidencias si tú también participas.
        </p>
      </header>

      {count === 0 ? (
        <p className="sb-trade-empty">
          Todavía no hay coincidencias. Aparecen cuando una carta que te falta está repetida en la
          colección de alguien que también participa. Agrega cartas a tu lista de deseos o marca tus
          repetidas en los binders.
        </p>
      ) : (
        <ul className="sb-trade-list">
          {data.entries.map((entry) => (
            <TradeEntryCard key={entry.userId} entry={entry} formatUsd={formatUsd} />
          ))}
        </ul>
      )}

      {data.truncated ? (
        <p className="sb-trade-intro">
          Hay más coleccionistas con intercambios de los que mostramos hoy.
        </p>
      ) : null}
    </main>
  );
}
