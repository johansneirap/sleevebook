import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDisplayMoney, formatRateDate } from "../../../../components/binder/binder-header";
import { CopyListButton } from "../../../../components/missing/copy-list-button";
import { AddMissingToWishlistButton } from "../../../../components/wishlist/add-missing-button";
import { requireBinderOwner } from "../../../../lib/session";
import { loadMissingList, parseSort, SORT_OPTIONS } from "./missing-list";
import "./faltan.css";

interface PageProps {
  params: Promise<{ binderId: string }>;
  searchParams: Promise<{ orden?: string }>;
}

export default async function MissingCardsPage({ params, searchParams }: PageProps) {
  const { binderId } = await params;
  await requireBinderOwner(binderId, `/binders/${binderId}/faltan`);
  const { orden } = await searchParams;
  const sort = parseSort(orden);

  const list = await loadMissingList(binderId, sort);
  if (!list) {
    notFound();
  }

  const { currency, rows } = list;
  const priceText = (price: number | null) =>
    price === null ? "sin precio" : formatDisplayMoney(price, currency);

  const copyText = rows
    .map(
      (row) =>
        `${row.name} ${row.number} (${row.variant}) · ${row.setName} — ${priceText(row.price)}`,
    )
    .join("\n");

  const rateNote = list.rateMissing
    ? "sin tipo de cambio"
    : list.rateCapturedAt && currency !== "usd"
      ? `tipo de cambio al ${formatRateDate(list.rateCapturedAt)}`
      : null;

  return (
    <main className="sb-miss-page">
      <Link href={`/binders/${binderId}`} className="sb-miss-back">
        &larr; Volver al binder
      </Link>

      <header className="sb-miss-card">
        <p className="sb-miss-eyebrow">Checklist del objetivo</p>
        <h1 className="sb-miss-title">Me faltan ({rows.length})</h1>
        {list.objectiveValue > 0 && (
          <p className="sb-miss-values">
            <span>Valor del objetivo:</span>{" "}
            <span className="sb-data">{formatDisplayMoney(list.objectiveValue, currency)}</span> —{" "}
            <span>Valor de lo que falta:</span>{" "}
            <span className="sb-data">{formatDisplayMoney(list.missingValue, currency)}</span>
            {rateNote && <span className="sb-miss-rate sb-data">{rateNote}</span>}
          </p>
        )}
      </header>

      {rows.length > 0 && (
        <section className="sb-miss-card" aria-label="Opciones de la lista">
          <nav aria-label="Ordenar lista" className="sb-miss-sort">
            <span className="sb-miss-sort-label">Ordenar por</span>
            <div className="sb-miss-segment">
              {SORT_OPTIONS.map((option) => {
                const active = option.value === sort;
                return (
                  <Link
                    key={option.value}
                    href={`/binders/${binderId}/faltan?orden=${option.value}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="sb-miss-actions">
            <CopyListButton text={copyText} />
            <span className="sb-miss-add">
              <AddMissingToWishlistButton variantIds={rows.map((row) => row.variantId)} />
            </span>
            <a
              href={`/binders/${binderId}/faltan/csv?orden=${sort}`}
              download
              className="sb-miss-csv"
            >
              Descargar CSV
            </a>
          </div>
        </section>
      )}

      {rows.length === 0 ? (
        <section className="sb-miss-card">
          <p className="sb-miss-empty">Tienes todas las cartas de este objetivo.</p>
        </section>
      ) : (
        <ul className="sb-miss-list">
          {rows.map((row) => (
            <li key={row.variantId} className="sb-miss-row">
              {row.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: catalog card images come from an external CDN
                <img
                  src={row.imageUrl}
                  alt=""
                  width={52}
                  height={73}
                  loading="lazy"
                  className="sb-miss-thumb"
                />
              ) : (
                <span aria-hidden className="sb-miss-thumb" />
              )}
              <div style={{ minWidth: 0 }}>
                <p className="sb-miss-name">
                  {row.name} <span className="sb-miss-num">{row.number}</span> ({row.variant})
                </p>
                <p className="sb-miss-meta">{row.setName}</p>
              </div>
              <span
                className="sb-miss-price sb-data"
                data-empty={row.price === null ? "true" : "false"}
              >
                {priceText(row.price)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
