import Link from "next/link";
import { listBinders } from "../../lib/binders";

export default async function BindersPage() {
  const binders = await listBinders();

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Mis binders</h1>
      <ul>
        {binders.map((b) => (
          <li key={b.id}>
            <Link href={`/binders/${b.id}`}>{b.name}</Link> — {b.formatRows}×{b.formatCols},{" "}
            {b.sheets} hojas, {b.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
