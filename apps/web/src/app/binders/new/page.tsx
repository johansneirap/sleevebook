import Link from "next/link";
import { NewBinderForm } from "../../../components/library/new-binder-form";
import "../../../components/library/catalog.css";
import { requireUser } from "../../../lib/session";

interface PageProps {
  searchParams: Promise<{ rows?: string; cols?: string }>;
}

const PRESETS = [
  { label: "2×2", rows: 2, cols: 2 },
  { label: "3×3", rows: 3, cols: 3 },
  { label: "4×3", rows: 4, cols: 3 },
  { label: "4×4", rows: 4, cols: 4 },
];

export default async function NewBinderPage({ searchParams }: PageProps) {
  await requireUser("/binders/new");
  const { rows, cols } = await searchParams;
  const defaultRows = rows ?? "3";
  const defaultCols = cols ?? "3";

  return (
    <main className="sb-catalog-page" style={{ maxWidth: 620 }}>
      <p style={{ margin: 0 }}>
        <Link href="/binders" className="sb-catalog-eyebrow" style={{ textDecoration: "none" }}>
          &larr; Mis binders
        </Link>
      </p>
      <h1 className="sb-catalog-title" style={{ marginTop: 28 }}>
        Crear binder
      </h1>

      <div style={{ marginTop: 36 }}>
        <p className="sb-catalog-eyebrow">Formatos estándar</p>
        <ul className="sb-preset-row">
          {PRESETS.map((preset) => (
            <li key={preset.label}>
              <Link
                className="sb-preset-link"
                href={`/binders/new?rows=${preset.rows}&cols=${preset.cols}`}
              >
                {preset.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <NewBinderForm
        key={`${defaultRows}x${defaultCols}`}
        defaultRows={defaultRows}
        defaultCols={defaultCols}
      />
    </main>
  );
}
