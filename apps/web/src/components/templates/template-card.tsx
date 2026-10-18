import Link from "next/link";
import { deleteTemplateForm, useTemplateForm } from "../../lib/template-actions";
import type { TemplateSummary } from "../../lib/templates";
import { TemplatePreview } from "./template-preview";

interface TemplateCardProps {
  template: TemplateSummary;
  signedIn: boolean;
}

function usesLabel(count: number): string {
  return count === 1 ? "Usada 1 vez" : `Usada ${count} veces`;
}

export function TemplateCard({ template, signedIn }: TemplateCardProps) {
  const { fragment } = template;
  return (
    <li className="sb-tpl-card">
      <TemplatePreview
        rows={template.formatRows}
        cols={template.formatCols}
        theme={fragment.theme}
        panels={fragment.panels}
      />
      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
        <h2 className="sb-tpl-name">{template.name}</h2>
        <p className="sb-tpl-meta">
          <span>@{template.author.handle}</span>
          <span className="sb-data">
            {template.formatRows}×{template.formatCols}
          </span>
          <span>
            {template.sheets} {template.sheets === 1 ? "hoja" : "hojas"}
          </span>
          <span>{usesLabel(template.usesCount)}</span>
          {template.isOwn && template.visibility === "private" && <span>Privada</span>}
        </p>
        {template.description && <p className="sb-tpl-desc">{template.description}</p>}
      </div>
      <div className="sb-tpl-actions">
        {signedIn ? (
          <form action={useTemplateForm}>
            <input type="hidden" name="templateId" value={template.id} />
            <button type="submit" className="sb-foil-action">
              Usar plantilla
            </button>
          </form>
        ) : (
          <Link
            href={`/entrar?next=${encodeURIComponent("/plantillas")}`}
            className="sb-foil-action"
          >
            Usar plantilla
          </Link>
        )}
        {template.isOwn && (
          <form action={deleteTemplateForm}>
            <input type="hidden" name="templateId" value={template.id} />
            <button type="submit" className="sb-tpl-quiet">
              Eliminar
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
