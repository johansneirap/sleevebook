import Link from "next/link";
import { unreadCount } from "../../lib/notifications";

// Bell icon button for the app shell. The accessible name carries the unread
// count; the coral dot/count is only visual.
const CSS = `
.sb-bell {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
}
.sb-bell:hover {
  background: var(--surface-2);
  color: var(--ink);
}
.sb-bell-dot {
  position: absolute;
  top: 8px;
  right: 9px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--coral);
  box-shadow: 0 0 0 2px var(--surface);
}
.sb-bell-badge {
  position: absolute;
  top: 3px;
  right: 0;
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  box-sizing: border-box;
  border-radius: 9px;
  background: var(--coral);
  color: var(--ink);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  box-shadow: 0 0 0 2px var(--surface);
}
`;

export async function NotificationBell({ userId }: { userId: string }) {
  const unread = await unreadCount(userId);
  const label = unread > 0 ? `Avisos (${unread} sin leer)` : "Avisos";

  return (
    <Link href="/avisos" className="sb-bell" aria-label={label}>
      <style>{CSS}</style>
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 9 ? (
        <span className="sb-bell-badge" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : unread > 0 ? (
        <span className="sb-bell-dot" aria-hidden="true" />
      ) : null}
    </Link>
  );
}
