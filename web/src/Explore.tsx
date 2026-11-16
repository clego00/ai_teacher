import { useState } from "react";
import type { ExploreList } from "../../shared/explore";
import type { SessionSummary } from "../../shared/types";
import { api } from "./api";

const nameOf = (sessions: SessionSummary[], folder: string) =>
  sessions.find((s) => s.folder === folder)?.title.replace(/^Learn: /, "") ?? folder;

/** Subjects to explore later: add one, start a session from it, or remove it. */
export default function Explore({
  explore,
  sessions,
  onOpenSession,
  onStarted,
  onError,
}: {
  explore: ExploreList;
  sessions: SessionSummary[];
  onOpenSession: (folder: string) => void;
  onStarted: (folder: string) => void;
  onError: (message: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const items = [...explore.items].reverse();
  const open = items.filter((i) => !i.started);
  const started = items.filter((i) => i.started);

  return (
    <section className="explore">
      <h3>To explore</h3>
      <form
        className="explore-add"
        onSubmit={(e) => {
          e.preventDefault();
          void act("add", async () => {
            await api.addSubject(subject, note);
            setSubject("");
            setNote("");
          });
        }}
      >
        <input id="explore-subject" value={subject} placeholder="Add a subject" aria-label="Subject" onChange={(e) => setSubject(e.target.value)} />
        {subject.trim() && (
          <>
            <input id="explore-note" value={note} placeholder="Why? (optional)" aria-label="Why" onChange={(e) => setNote(e.target.value)} />
            <button type="submit" disabled={busy === "add"}>
              Add
            </button>
          </>
        )}
      </form>
      {open.length === 0 && <p className="muted">Nothing yet. Add a subject here, or ask the teacher in a lesson.</p>}
      {open.map((i) => (
        <div key={i.id} className="explore-item">
          <div className="explore-subject">{i.subject}</div>
          {i.note && <div className="explore-note">{i.note}</div>}
          {i.from && (
            <div className="explore-from">
              From{" "}
              <button className="link" onClick={() => onOpenSession(i.from!)}>
                {nameOf(sessions, i.from)}
              </button>
            </div>
          )}
          <div className="actions">
            <button
              className="primary"
              disabled={busy !== null}
              onClick={() => act(i.id, async () => onStarted((await api.startSubject(i.id)).folder))}
            >
              {busy === i.id ? "Starting…" : "Start a session"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => window.confirm(`Remove "${i.subject}" from the list?`) && act(i.id, () => api.removeSubject(i.id))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      {started.length > 0 && (
        <details className="explore-started">
          <summary>Started ({started.length})</summary>
          {started.map((i) => (
            <div key={i.id} className="explore-started-row">
              <button className="link" onClick={() => onOpenSession(i.started!)}>
                {i.subject}
              </button>
              <button
                className="link muted"
                disabled={busy !== null}
                onClick={() => window.confirm(`Remove "${i.subject}" from the list?`) && act(i.id, () => api.removeSubject(i.id))}
              >
                Remove
              </button>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
