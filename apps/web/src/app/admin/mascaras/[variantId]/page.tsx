import { defaultFoilMask } from "@sleevebook/binder-core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FoilMaskEditor } from "../../../../components/foil-mask-editor/foil-mask-editor";
import { SiteNav } from "../../../../components/site/site-nav";
import { getVariantDisplays } from "../../../../lib/binders";
import { FOIL_VARIANT_LABEL, FOIL_VARIANTS } from "../../../../lib/foil-masks";
import { isAdmin, requireUser } from "../../../../lib/session";
import "../../../../components/library/catalog.css";

export const metadata: Metadata = {
  title: "Editar máscara de foil",
  robots: { index: false, follow: false },
};

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

interface PageProps {
  params: Promise<{ variantId: string }>;
}

export default async function MascaraEditorPage({ params }: PageProps) {
  const { variantId } = await params;
  const viewer = await requireUser(`/admin/mascaras/${variantId}`);
  if (!isAdmin(viewer) || !UUID_PATTERN.test(variantId)) {
    notFound();
  }

  const display = (await getVariantDisplays([variantId])).get(variantId);
  if (!display || !(FOIL_VARIANTS as readonly string[]).includes(display.variant)) {
    notFound();
  }

  const saved = display.foilMask ?? null;
  const variantLabel = FOIL_VARIANT_LABEL[display.variant] ?? display.variant;

  return (
    <>
      <SiteNav current="/admin/mascaras" />
      <main className="sb-catalog-page">
        <header>
          <p className="sb-catalog-eyebrow">
            <Link href="/admin/mascaras">Máscaras de foil</Link> · Editor
          </p>
          <h1 className="sb-catalog-title">{display.name}</h1>
          <p className="sb-catalog-meta sb-data" style={{ marginTop: 12 }}>
            <span>{display.setName}</span>
            <span>#{display.number}</span>
            <span>{variantLabel}</span>
          </p>
        </header>

        <div style={{ marginTop: 40 }}>
          <FoilMaskEditor
            variantId={display.id}
            cardName={display.name}
            variantKind={display.variant}
            imageUrl={display.imageUrl}
            initialMask={saved ?? defaultFoilMask(display.variant)}
            initialEdited={saved !== null}
          />
        </div>
      </main>
    </>
  );
}
