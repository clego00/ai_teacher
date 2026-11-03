import { useEffect, useState } from "react";
import type { SessionDetail, SessionSummary } from "../../shared/types";
import { api } from "./api";
import Markdown from "./Markdown";

function statusOf(s: SessionSummary) {
  return s.wrappedUp ? "Wrapped up" : "In progress";
}

export function SessionRow({ session, onOpen }: { session: SessionSummary; onOpen: (folder: string) => void }) {
  return (
    <button className="row session-row" onClick={() => onOpen(session.folder)}>
      <span className={`status-dot ${session.running ? "on" : ""}`} aria-hidden />
      <span className="row-main">{session.title.replace(/^Learn: /, "")}</span>
      <span className="row-side">
        {statusOf(session)}
        {session.running ? " · running" : ""}
      </span>
    </button>
  );
}

/** Buttons to control a session. Shown in the reader, and refreshes via the app's polling. */
export function SessionActions({ session, onError }: { session: SessionSummary; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const act = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="actions">
      {session.url ? (
        <a className="button primary" href={session.url} target="_blank" rel="noreferrer">
          Open in Claude
        </a>
      ) : (
        session.running && !session.problem && <span className="muted">Waiting for the Claude link…</span>
      )}
      {session.running ? (
        <>
          <button disabled={busy} onClick={act(() => api.wrapUp(session.folder))}>
            Wrap up
          </button>
          <button disabled={busy} onClick={act(() => api.end(session.folder))}>
            End
          </button>
        </>
      ) : (
        <button disabled={busy} onClick={act(() => api.resume(session.folder))}>
          Resume
        </button>
      )}
    </div>
  );
}

/** One session's summary, notes and artifacts, in place of the map. */
export function SessionReader({
  folder,
  onClose,
  onError,
}: {
  folder: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      api
        .session(folder)
        .then((d) => !stop && setDetail(d))
        .catch((e) => !stop && onError(e.message));
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [folder, onError]);

  if (!detail) return <div className="reader muted">Loading…</div>;
  const { session, summary, notes, artifacts } = detail;
  return (
    <div className="reader">
      <button className="link back" onClick={onClose}>
        ← Back to the map
      </button>
      <h1>{session.title.replace(/^Learn: /, "")}</h1>
      <p className="muted">
        {new Date(session.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })} · {statusOf(session)}
        {session.running ? " · running" : " · stopped"}
      </p>
      {session.problem && <p className="problem">{session.problem}</p>}
      <SessionActions session={session} onError={onError} />
      {artifacts.length > 0 && (
        <section>
          <h2>Artifacts</h2>
          <ul className="artifacts">
            {artifacts.map((f) => (
              <li key={f}>
                <a href={api.artifactUrl(folder, f)} target="_blank" rel="noreferrer">
                  {f}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary ? (
        <section>
          <Markdown text={summary} />
        </section>
      ) : (
        <p className="muted">No summary yet. It's written when you wrap up.</p>
      )}
      {notes && (
        <details className="notes" open={!summary}>
          <summary>Notes from the session</summary>
          <Markdown text={notes} />
        </details>
      )}
    </div>
  );
}
