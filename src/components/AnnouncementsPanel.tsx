import { useEffect, useState } from "react";
import Modal from "./Modal";
import {
  listMyAnnouncements,
  listAnnouncementFiles,
  getInlineUrl,
  type Announcement,
  type AnnouncementFile,
} from '../services/announcementService'

type ViewFile = AnnouncementFile & {
  url: string | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

const LAST_SEEN_KEY = "matta_announcements_last_seen";

function getLastSeen(): number {
  try {
    const v = localStorage.getItem(LAST_SEEN_KEY);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function setLastSeenNow() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export default function AnnouncementsPanel() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Announcement | null>(null);
  const [viewFiles, setViewFiles] = useState<ViewFile[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(getLastSeen());

  useEffect(() => {
    listMyAnnouncements().then((result: Awaited<ReturnType<typeof listMyAnnouncements>>) => {
      const { announcements, error } = result;
      if (!error) setItems(announcements);
      setLoading(false);
    });
  }, []);

  const isUnread = (a: Announcement) =>
    new Date(a.created_at).getTime() > lastSeen;
  const unreadCount = items.filter(isUnread).length;

  // Opening an announcement marks everything up to now as seen.
  const openAnnouncement = (a: Announcement) => {
    setOpen(a);
    setLastSeenNow();
    setLastSeen(Date.now());
  };

  // When an announcement opens, load its attachments and sign inline URLs.
  useEffect(() => {
    if (!open) {
      setViewFiles([]);
      return;
    }
    let cancelled = false;
    listAnnouncementFiles(open.id).then(async (result: Awaited<ReturnType<typeof listAnnouncementFiles>>) => {
      const { files } = result;
      const signed = await Promise.all(
        files.map(async (file: AnnouncementFile) => {
          const { url } = await getInlineUrl(file.storage_path);
          return { ...file, url } as ViewFile;
        }),
      );
      if (!cancelled) setViewFiles(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const blockDownload = (e: React.MouseEvent) => e.preventDefault();

  return (
    <aside className="announce-panel">
      <div className="announce-panel-head">
        <span className="announce-panel-title">📢 Latest 最新公告</span>
        {unreadCount > 0 && (
          <span className="announce-unread-badge">{unreadCount} new 未讀</span>
        )}
      </div>

      {loading ? (
        <p className="announce-panel-empty">Loading…</p>
      ) : items.length === 0 ? (
        <p className="announce-panel-empty">
          No announcements yet. 目前沒有公告。
        </p>
      ) : (
        <ul className="announce-panel-list">
          {items.slice(0, 15).map((a) => (
            <li key={a.id}>
              <button
                className={`announce-panel-item ${isUnread(a) ? "unread" : ""}`}
                onClick={() => openAnnouncement(a)}
              >
                <span className="announce-panel-date">
                  {isUnread(a) && (
                    <span className="announce-dot" aria-label="new" />
                  )}
                  {formatDate(a.created_at)}
                </span>
                <span className="announce-panel-subject">{a.title}</span>
                {!a.is_global && (
                  <span className="announce-panel-tag">for you 給你</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.title ?? ""}
        size="md"
      >
        {open && (
          <div>
            <p className="announce-modal-meta">
              {formatDate(open.created_at)}
              {open.author_name ? ` · ${open.author_name}` : ""}
              {open.is_global
                ? " · All users 全部使用者"
                : " · Sent to you 發給你"}
            </p>
            <p className="announce-modal-body">{open.body}</p>

            {viewFiles.length > 0 && (
              <div className="announce-attachments">
                <p className="announce-attach-note">
                  📎 Attachments · view only 附件（僅供閱讀，不可下載）
                </p>
                {viewFiles.map((f) => (
                  <div
                    key={f.id}
                    className="announce-attach"
                    onContextMenu={blockDownload}
                  >
                    <p className="announce-attach-name">{f.file_name}</p>
                    {!f.url ? (
                      <p className="muted small">Could not load preview.</p>
                    ) : f.file_type?.startsWith("image/") ? (
                      <img
                        src={f.url}
                        alt={f.file_name}
                        className="announce-attach-img"
                        draggable={false}
                      />
                    ) : (
                      <iframe
                        // #toolbar=0 hides the PDF viewer's download/print bar in Chromium
                        src={`${f.url}#toolbar=0&navpanes=0`}
                        title={f.file_name}
                        className="announce-attach-pdf"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setOpen(null)}>
                Close 關閉
              </button>
            </div>
          </div>
        )}
      </Modal>
    </aside>
  );
}
