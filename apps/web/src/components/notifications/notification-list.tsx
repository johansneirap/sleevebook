"use client";

import Link from "next/link";
import { markRead } from "../../lib/notification-actions";

export interface InboxItem {
  id: string;
  kindLabel: string;
  title: string;
  body: string | null;
  href: string | null;
  when: string;
  whenIso: string;
  unread: boolean;
}

interface NotificationListProps {
  items: InboxItem[];
  /** Cursor for the next page (ISO date of the last item), when there may be more. */
  nextBefore: string | null;
}

export function NotificationList({ items, nextBefore }: NotificationListProps) {
  if (items.length === 0) {
    return (
      <p className="sb-avisos-empty">
        Todavía no hay avisos. Te avisamos cuando baje el precio de una carta que deseas o salga un
        set con tus especies.
      </p>
    );
  }

  return (
    <>
      <ul className="sb-avisos-list">
        {items.map((item) => (
          <NotificationRow key={item.id} item={item} />
        ))}
      </ul>
      {nextBefore ? (
        <p className="sb-avisos-more">
          <Link href={`/avisos?antes=${encodeURIComponent(nextBefore)}`} className="sb-quiet-link">
            Ver avisos anteriores
          </Link>
        </p>
      ) : null}
    </>
  );
}

function NotificationRow({ item }: { item: InboxItem }) {
  const content = (
    <>
      <span className="sb-avisos-mark" aria-hidden="true">
        {item.unread ? <span className="sb-avisos-dot" /> : null}
      </span>
      {item.unread ? <span className="sb-avisos-sr">Sin leer. </span> : null}
      <span className="sb-label sb-avisos-kind">{item.kindLabel}</span>
      <time className="sb-data sb-avisos-when" dateTime={item.whenIso}>
        {item.when}
      </time>
      <span className="sb-avisos-title">{item.title}</span>
      {item.body ? <span className="sb-avisos-body">{item.body}</span> : null}
    </>
  );

  return (
    <li className="sb-avisos-item" data-unread={item.unread ? "true" : undefined}>
      {item.href ? (
        <Link
          href={item.href}
          className="sb-avisos-link"
          onClick={() => {
            // Opening the notification marks it read; the navigation carries on.
            if (item.unread) {
              void markRead(item.id);
            }
          }}
        >
          {content}
        </Link>
      ) : (
        <div className="sb-avisos-link">{content}</div>
      )}
    </li>
  );
}
