import Link from "next/link";
import { createBinder } from "../../../lib/binder-actions";

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
  const { rows, cols } = await searchParams;
  const defaultRows = rows ?? "3";
  const defaultCols = cols ?? "3";

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 420 }}>
      <p>
        <Link href="/binders">&larr; Mis binders</Link>
      </p>
      <h1>Crear binder</h1>

      <p>Formatos estándar:</p>
      <p style={{ display: "flex", gap: 8 }}>
        {PRESETS.map((preset) => (
          <Link key={preset.label} href={`/binders/new?rows=${preset.rows}&cols=${preset.cols}`}>
            {preset.label}
          </Link>
        ))}
      </p>

      <form action={createBinder} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Nombre
          <br />
          <input type="text" name="name" placeholder="Mi binder" required />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <label>
            Filas
            <br />
            <input type="number" name="rows" min={1} max={6} defaultValue={defaultRows} />
          </label>
          <label>
            Columnas
            <br />
            <input type="number" name="cols" min={1} max={6} defaultValue={defaultCols} />
          </label>
          <label>
            Hojas
            <br />
            <input type="number" name="sheets" min={1} max={200} defaultValue={20} />
          </label>
        </div>

        <label>
          Apertura
          <br />
          <select name="opening" defaultValue="side">
            <option value="side">Lateral</option>
            <option value="top">Vertical</option>
          </select>
        </label>

        <button type="submit">Crear</button>
      </form>
    </main>
  );
}
