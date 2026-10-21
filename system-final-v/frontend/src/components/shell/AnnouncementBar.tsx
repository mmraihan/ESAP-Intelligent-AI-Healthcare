/**
 * Platform notices at the top of every signed-in shell (published from
 * /ops/announcements). A dismissal is remembered per browser, per notice —
 * an edited or new notice shows again.
 */
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { isLive } from "@/api/actions";
import type { Announcement } from "@/api/desk";
import { AlertIcon, InfoIcon, XIcon } from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";

const KEY = "esap.dismissedAnnouncements";

/** Any edit bumps `updatedAt` on the server, so a changed notice gets a new key. */
function dismissKey(a: Announcement): string {
  return `${a.id}:${a.updatedAt ?? a.createdAt}`;
}

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function AnnouncementBar() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  useEffect(() => {
    if (!isLive()) return;
    const ctrl = new AbortController();
    api.get<{ announcements: Announcement[] }>("/api/v1/announcements", ctrl.signal)
      .then((r) => setItems(r.announcements))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);

  function dismiss(a: Announcement) {
    const next = [...dismissed, dismissKey(a)].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: it stays dismissed for this page view only.
    }
  }

  const shown = items.filter((a) => !dismissed.includes(dismissKey(a)));
  if (shown.length === 0) return null;
  return (
    <div className="announce-stack">
      {shown.map((a) => (
        <div key={a.id} className={cx("announce", a.level !== "info" && "is-attention")} role="status" lang="en">
          {a.level === "info" ? <InfoIcon size={15} /> : <AlertIcon size={15} />}
          <span className="announce-text">
            <strong>{a.title}</strong> {a.body}
          </span>
          <button type="button" className="icon-btn" onClick={() => dismiss(a)} aria-label={`Dismiss: ${a.title}`}>
            <XIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
