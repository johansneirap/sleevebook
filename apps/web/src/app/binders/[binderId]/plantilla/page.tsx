import Link from "next/link";
import { notFound } from "next/navigation";
import { SaveTemplateForm } from "../../../../components/templates/save-template-form";
import { TemplatePreview } from "../../../../components/templates/template-preview";
import "../../../../components/library/catalog.css";
import "../../../../components/templates/templates.css";
import { getBinderWithLayout } from "../../../../lib/binders";
import { requireBinderOwner } from "../../../../lib/session";
import { resolveThemeTokens } from "../../../../lib/theme-presets";

interface PageProps {
  params: Promise<{ binderId: string }>;
}

export default async function SaveTemplatePage({ params }: PageProps) {
  const { binderId } = await params;
  await requireBinderOwner(binderId, `/binders/${binderId}/plantilla`);

  const data = await getBinderWithLayout(binderId);
  if (!data) {
    notFound();
  }

  const { layout } = data;
  const { rows, cols } = layout.format;
  const tokens = resolveThemeTokens(layout.theme);

  return (
    <main className="sb-catalog-page sb-tpl-save-page">
      <p className="sb-tpl-save-head">
        <Link href={`/binders/${binderId}/editar`} className="sb-tpl-back">
          &larr; Volver al editor
        </Link>
      </p>
      <h1 className="sb-catalog-title" style={{ marginTop: 20 }}>
        Guardar como plantilla
      </h1>
      <p className="sb-tpl-save-lead">
        Una plantilla guarda el diseño de este binder para crear otros iguales. Nunca guarda sus
        cartas.
      </p>

      <div className="sb-tpl-save-grid">
        <TemplatePreview
          rows={rows}
          cols={cols}
          theme={layout.theme}
          panels={layout.panels}
          size="detail"
        />
        <dl className="sb-tpl-included">
          <div>
            <dt>Se guarda</dt>
            <dd>
              Formato{" "}
              <span className="sb-data">
                {rows}×{cols}
              </span>
              , {data.sheets} {data.sheets === 1 ? "hoja" : "hojas"}, apertura{" "}
              {layout.opening === "top" ? "vertical" : "lateral"}
            </dd>
          </div>
          <div>
            <dt>Tema</dt>
            <dd>
              <span
                className="sb-tpl-swatch"
                aria-hidden="true"
                style={{ background: tokens.background }}
              />
              {tokens.label}
            </dd>
          </div>
          <div>
            <dt>Diseño</dt>
            <dd>
              <span className="sb-data">{layout.panels.length}</span>{" "}
              {layout.panels.length === 1 ? "panel de arte" : "paneles de arte"},{" "}
              <span className="sb-data">{layout.sections.length}</span>{" "}
              {layout.sections.length === 1 ? "sección" : "secciones"}
            </dd>
          </div>
          <div>
            <dt>No se guarda</dt>
            <dd>Las cartas, sus precios, las notas ni los bolsillos con contenido.</dd>
          </div>
        </dl>
      </div>

      <SaveTemplateForm binderId={binderId} defaultName={`${data.name} (diseño)`} />
    </main>
  );
}
