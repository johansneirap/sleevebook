import Link from "next/link";
import { SiteNav } from "../../components/site/site-nav";
import { TemplateCard } from "../../components/templates/template-card";
import "../../components/library/catalog.css";
import "../../components/templates/templates.css";
import { getCurrentUser } from "../../lib/session";
import { listTemplates } from "../../lib/templates";

interface PageProps {
  searchParams: Promise<{ vista?: string; nueva?: string }>;
}

export default async function TemplatesPage({ searchParams }: PageProps) {
  const { vista, nueva } = await searchParams;
  const viewer = await getCurrentUser();
  const onlyMine = Boolean(viewer) && vista === "mias";

  const all = await listTemplates({ mine: viewer?.id ?? null });
  const shown = onlyMine ? all.filter((template) => template.isOwn) : all;
  const created = nueva ? all.find((template) => template.id === nueva) : undefined;

  return (
    <main className="sb-catalog-page">
      <SiteNav current="/plantillas" />

      <p className="sb-catalog-eyebrow">Diseños para compartir</p>
      <h1 className="sb-catalog-title" style={{ marginTop: 10 }}>
        Plantillas
      </h1>
      <p
        style={{
          margin: "14px 0 0",
          maxWidth: 580,
          fontFamily: "var(--font-ui)",
          color: "var(--smoke)",
        }}
      >
        Formato, apertura, tema, paneles de arte y secciones. Una plantilla nunca incluye cartas.
      </p>

      {viewer && (
        <nav aria-label="Filtrar plantillas">
          <ul className="sb-tpl-tabs">
            <li>
              <Link href="/plantillas" aria-current={onlyMine ? undefined : "page"}>
                Todas
              </Link>
            </li>
            <li>
              <Link href="/plantillas?vista=mias" aria-current={onlyMine ? "page" : undefined}>
                Mías
              </Link>
            </li>
          </ul>
        </nav>
      )}

      {created && (
        <p className="sb-tpl-notice" role="status">
          Plantilla guardada: «{created.name}» ya aparece{" "}
          {created.visibility === "public" ? "en la galería" : "solo para ti"}.
        </p>
      )}

      {shown.length === 0 ? (
        <p style={{ margin: "48px 0 0", fontFamily: "var(--font-ui)", color: "var(--smoke)" }}>
          {onlyMine
            ? "Aún no has guardado plantillas. Abre un binder y elige «Guardar como plantilla»."
            : "Todavía no hay plantillas públicas."}
        </p>
      ) : (
        <ul className="sb-tpl-grid">
          {shown.map((template) => (
            <TemplateCard key={template.id} template={template} signedIn={Boolean(viewer)} />
          ))}
        </ul>
      )}
    </main>
  );
}
