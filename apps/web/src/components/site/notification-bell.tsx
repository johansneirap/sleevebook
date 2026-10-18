import Link from "next/link";
import { unreadCount } from "../../lib/notifications";

// Quiet "Avisos" link in SiteNav. The unread count is a foil badge only when
// there is something unread; the accessible name carries the count.
const CSS = `
.sb-bell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sb-bell-badge {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--foil);
  color: var(--velvet);
  font-family: var(--font-data);
  font-size: 11px;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
`;

export async function NotificationBell({ userId }: { userId: string }) {
  const unread = await unreadCount(userId);
  const label = unread > 0 ? `Avisos (${unread} sin leer)` : "Avisos";

  return (
    <Link href="/avisos" className="sb-bell" aria-label={label}>
      <style>{CSS}</style>
      <span aria-hidden="true">Avisos</span>
      {unread > 0 ? (
        <span className="sb-bell-badge" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
