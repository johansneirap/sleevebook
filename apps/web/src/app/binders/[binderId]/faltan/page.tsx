import Link from "next/link";
import { notFound } from "next/navigation";
import { getVariantDisplays } from "../../../../lib/binders";
import { getGoalProgress } from "../../../../lib/goals";

interface PageProps {
  params: Promise<{ binderId: string }>;
}

export default async function MissingCardsPage({ params }: PageProps) {
  const { binderId } = await params;

  const progress = await getGoalProgress(binderId);
  if (!progress) {
    notFound();
  }

  const displays = await getVariantDisplays(progress.missingVariantIds);
  const missing = progress.missingVariantIds
    .map((id) => displays.get(id))
    .filter((display): display is NonNullable<typeof display> => display !== undefined)
    .sort((a, b) => a.setName.localeCompare(b.setName) || a.name.localeCompare(b.name));

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>
        <Link href={`/binders/${binderId}`}>&larr; Volver al binder</Link>
      </p>
      <h1>Me faltan ({missing.length})</h1>
      <p style={{ color: "#888", fontSize: 13 }}>
        Todavía no hay precios cargados (llegan en un bloque posterior), así que por ahora está
        ordenada por set y nombre.
      </p>
      <ul>
        {missing.map((item) => (
          <li key={item.id}>
            {item.setName} — {item.name} {item.number} ({item.variant})
          </li>
        ))}
      </ul>
    </main>
  );
}
