import Link from "next/link";
import { DeleteBinderForm } from "../../components/binder/delete-binder-form";
import { duplicateBinder, renameBinder, setBinderStatus } from "../../lib/binder-actions";
import { listBinders } from "../../lib/binders";

export default async function BindersPage() {
  const binders = await listBinders();

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Mis binders</h1>
      <p>
        <Link href="/binders/new">+ Crear binder</Link>
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {binders.map((b) => (
          <li
            key={b.id}
            style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12, marginBottom: 8 }}
          >
            <div>
              <Link href={`/binders/${b.id}`}>{b.name}</Link> — {b.formatRows}×{b.formatCols},{" "}
              {b.sheets} hojas, {b.status}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                fontSize: 13,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <form action={renameBinder} style={{ display: "flex", gap: 4 }}>
                <input type="hidden" name="binderId" value={b.id} />
                <input type="text" name="name" defaultValue={b.name} style={{ fontSize: 13 }} />
                <button type="submit">Renombrar</button>
              </form>

              <form action={duplicateBinder}>
                <input type="hidden" name="binderId" value={b.id} />
                <button type="submit">Duplicar</button>
              </form>

              <form action={setBinderStatus}>
                <input type="hidden" name="binderId" value={b.id} />
                <input
                  type="hidden"
                  name="status"
                  value={b.status === "archived" ? "draft" : "archived"}
                />
                <button type="submit">
                  {b.status === "archived" ? "Desarchivar" : "Archivar"}
                </button>
              </form>

              <DeleteBinderForm binderId={b.id} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
