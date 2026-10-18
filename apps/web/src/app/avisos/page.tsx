import { kindLabel, relativeTime } from "../../components/notifications/format";
import { NotificationList } from "../../components/notifications/notification-list";
import { SpeciesPanel } from "../../components/notifications/species-panel";
import { SiteNav } from "../../components/site/site-nav";
import "../../components/library/catalog.css";
import "../../components/notifications/avisos.css";
import { markAllRead } from "../../lib/notification-actions";
import {
  listDerivedSpecies,
  listFollowedSpecies,
  listNotifications,
  unreadCount,
} from "../../lib/notifications";
import { requireUser } from "../../lib/session";

const PAGE_SIZE = 50;

export default async function AvisosPage({
  searchParams,
}: {
  searchParams: Promise<{ antes?: string }>;
}) {
  const viewer = await requireUser("/avisos");
  const { antes } = await searchParams;
  const parsedBefore = antes ? new Date(antes) : null;
  const before = parsedBefore && !Number.isNaN(parsedBefore.getTime()) ? parsedBefore : undefined;

  const [items, unread, derived, followed] = await Promise.all([
    listNotifications(viewer.id, { limit: PAGE_SIZE, before }),
    unreadCount(viewer.id),
    listDerivedSpecies(viewer.id),
    listFollowedSpecies(viewer.id),
  ]);

  const now = new Date();
  const inbox = items.map((item) => ({
    id: item.id,
    kindLabel: kindLabel(item.kind),
    title: item.title,
    body: item.body,
    href: item.href,
    when: relativeTime(item.createdAt, now),
    whenIso: item.createdAt.toISOString(),
    unread: item.readAt === null,
  }));
  const last = items.at(-1);
  const nextBefore = items.length === PAGE_SIZE && last ? last.createdAt.toISOString() : null;

  return (
    <main className="sb-catalog-page">
      <SiteNav current="/avisos" />
      <header className="sb-avisos-header">
        <div>
          <p className="sb-catalog-eyebrow">Bandeja privada · {unread} sin leer</p>
          <h1 className="sb-catalog-title">Avisos</h1>
        </div>
        <form action={markAllRead}>
          <button type="submit" className="sb-foil-action" disabled={unread === 0}>
            Marcar todo como leído
          </button>
        </form>
      </header>

      <div className="sb-avisos-grid">
        <section aria-labelledby="avisos-bandeja">
          <h2 id="avisos-bandeja" className="sb-label sb-avisos-subtitle">
            Bandeja
          </h2>
          <NotificationList items={inbox} nextBefore={nextBefore} />
        </section>

        <SpeciesPanel derived={derived} followed={followed} />
      </div>
    </main>
  );
}
