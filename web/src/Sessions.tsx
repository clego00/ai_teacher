import { useEffect, useRef, useState } from "react";
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
      {session.notesUrl && (
        <a className="button" href={session.notesUrl} target="_blank" rel="noreferrer">
          Notes in Claude
        </a>
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

/**
 * The session's notes.html, sandboxed like artifacts. The page reports its height so the frame
 * grows with it, and a new version (the file's mtime) reloads it.
 */
function NotesFrame({ src }: { src: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === "ait-notes-height") {
        setHeight(Math.max(200, Math.ceil(Number(e.data.height) || 0)));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return (
    <iframe
      ref={frame}
      className="notes-frame"
      title="Lesson notes"
      src={src}
      sandbox="allow-scripts allow-popups"
      style={{ height }}
    />
  );
}

/** One session's notes and artifacts, in place of the map. */
export function SessionReader({
  folder,
  onClose,
  onOpen,
  onError,
}: {
  folder: string;
  onClose: () => void;
  onOpen: (folder: string) => void;
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
  const { session, notesVersion, summary, notes, artifacts, parent, children } = detail;
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
      {parent && (
        <p className="origin">
          Started from:{" "}
          <button className="link" onClick={() => onOpen(parent.folder)}>
            {parent.title.replace(/^Learn: /, "")}
          </button>
        </p>
      )}
      {session.problem && <p className="problem">{session.problem}</p>}
      <SessionActions session={session} onError={onError} />
      {children.length > 0 && (
        <section>
          <h2>Sessions started from here</h2>
          {children.map((s) => (
            <SessionRow key={s.folder} session={s} onOpen={onOpen} />
          ))}
        </section>
      )}
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
      {notesVersion ? (
        <NotesFrame src={api.notesUrl(folder, notesVersion)} />
      ) : (
        <>
          {summary ? (
            <section>
              <Markdown text={summary} />
            </section>
          ) : (
            !notes && <p className="muted no-summary">No notes yet. They're written as the lesson goes.</p>
          )}
          {notes && (
            <details className="notes" open={!summary}>
              <summary>Notes from the session</summary>
              <Markdown text={notes} />
            </details>
          )}
        </>
      )}
    </div>
  );
}
