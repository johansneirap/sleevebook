import { getCollection } from "../../../lib/collection";
import { collectionCsv } from "../../../lib/collection-csv";
import { getCurrentUser } from "../../../lib/session";

/** "Exportar CSV" of the signed-in user's copies. Other visitors get a 401. */
export async function GET(): Promise<Response> {
  const viewer = await getCurrentUser();
  if (!viewer) {
    return new Response("No autorizado", { status: 401 });
  }
  const { entries } = await getCollection(viewer.id);
  return new Response(collectionCsv(entries), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sleevebook-coleccion.csv"',
      "Cache-Control": "no-store",
    },
  });
}
