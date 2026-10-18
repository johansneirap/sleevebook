import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDisplayMoney, formatRateDate } from "../../../../components/binder/binder-header";
import { CopyListButton } from "../../../../components/missing/copy-list-button";
import "../../../../components/library/catalog.css";
import { requireBinderOwner } from "../../../../lib/session";
import { loadMissingList, parseSort, SORT_OPTIONS } from "./missing-list";

interface PageProps {
  params: Promise<{ binderId: string }>;
  searchParams: Promise<{ orden?: string }>;
}

const SORT_LINK_STYLE = {
  color: "var(--smoke)",
  textDecoration: "none",
  borderBottom: "1px solid transparent",
  paddingBottom: 2,
  fontSize: 13,
} as const;

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
    <main className="sb-catalog-page">
      <p style={{ margin: 0 }}>
        <Link
          href={`/binders/${binderId}`}
          className="sb-catalog-eyebrow"
          style={{ textDecoration: "none" }}
        >
          &larr; Volver al binder
        </Link>
      </p>

      <header style={{ marginTop: 28 }}>
        <p className="sb-catalog-eyebrow">Checklist del objetivo</p>
        <h1 className="sb-catalog-title">Me faltan ({rows.length})</h1>
        {list.objectiveValue > 0 && (
          <p className="sb-checklist-summary">
            <span className="sb-label">Valor del objetivo:</span>{" "}
            <span className="sb-data">{formatDisplayMoney(list.objectiveValue, currency)}</span> —{" "}
            <span className="sb-label">Valor de lo que falta:</span>{" "}
            <span className="sb-data">{formatDisplayMoney(list.missingValue, currency)}</span>
            {rateNote && (
              <span
                className="sb-data"
                style={{ display: "block", fontSize: 12, color: "var(--smoke)" }}
              >
                {rateNote}
              </span>
            )}
          </p>
        )}
      </header>

      {rows.length > 0 && (
        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "14px 24px",
          }}
        >
          <nav
            aria-label="Ordenar lista"
            style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 16px" }}
          >
            <span className="sb-catalog-eyebrow">Ordenar:</span>
            {SORT_OPTIONS.map((option) => {
              const active = option.value === sort;
              return (
                <Link
                  key={option.value}
                  href={`/binders/${binderId}/faltan?orden=${option.value}`}
                  aria-current={active ? "page" : undefined}
                  style={{
                    ...SORT_LINK_STYLE,
                    color: active ? "var(--foil)" : "var(--smoke)",
                    borderBottomColor: active ? "var(--foil)" : "transparent",
                  }}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: "6px 18px",
            }}
          >
            <CopyListButton text={copyText} />
            <a
              href={`/binders/${binderId}/faltan/csv?orden=${sort}`}
              download
              className="sb-quiet-button"
              style={{ textDecoration: "none" }}
            >
              Descargar CSV
            </a>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="sb-catalog-empty">Tienes todas las cartas de este objetivo.</p>
      ) : (
        <div style={{ marginTop: 24 }}>
          <div className="sb-checklist-head" aria-hidden="true">
            <span style={{ gridArea: "set" }}>Set</span>
            <span style={{ gridArea: "name" }}>Carta</span>
            <span style={{ gridArea: "price", textAlign: "right" }}>Precio</span>
          </div>
          <ul className="sb-checklist" style={{ marginTop: 0 }}>
            {rows.map((row) => (
              <li key={row.variantId} className="sb-checklist-row">
                <span className="sb-checklist-set">{row.setName}</span>
                <span className="sb-checklist-name">
                  {row.name} <span className="sb-checklist-num">{row.number}</span> ({row.variant})
                </span>
                <span
                  className="sb-checklist-price"
                  style={row.price === null ? { color: "var(--smoke)" } : undefined}
                >
                  {priceText(row.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
