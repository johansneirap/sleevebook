import Link from "next/link";
import { BinderCatalogEntry } from "../../components/library/binder-catalog-entry";
import { binderCoverColor } from "../../components/library/binder-cover";
import { SiteNav } from "../../components/site/site-nav";
import { getBinderWithLayout, listBinders } from "../../lib/binders";
import { getGoalProgress } from "../../lib/goals";
import "../../components/library/catalog.css";
import { requireUser } from "../../lib/session";

export default async function BindersPage() {
  const current = await requireUser("/binders");
  const binders = await listBinders(current.id);

  // Small list: one lookup per binder for its theme (cover color) and goal.
  const cards = await Promise.all(
    binders.map(async (b) => {
      const [full, goal] = await Promise.all([getBinderWithLayout(b.id), getGoalProgress(b.id)]);
      return {
        binder: b,
        cover: binderCoverColor(full?.layout.theme ?? { preset: "default", sleeve: "clear" }),
        goal,
      };
    }),
  );

  return (
    <>
      <SiteNav current="/binders" />
      <main className="sb-catalog-page">
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <p className="sb-catalog-eyebrow">
              {binders.length} {binders.length === 1 ? "binder" : "binders"} en tu colección
            </p>
            <h1 className="sb-catalog-title">Mis binders</h1>
          </div>
          <Link href="/binders/new" className="sb-foil-action">
            + Crear binder
          </Link>
        </header>

        {binders.length === 0 ? (
          <p className="sb-catalog-empty">Todavía no hay binders en la colección.</p>
        ) : (
          <ul className="sb-catalog-list">
            {cards.map((card, index) => (
              <BinderCatalogEntry
                key={card.binder.id}
                binder={card.binder}
                index={index}
                cover={card.cover}
                goal={card.goal}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
