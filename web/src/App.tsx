import { useCallback, useEffect, useState } from "react";
import { pathTo } from "../../shared/map";
import type { AppState } from "../../shared/types";
import { api } from "./api";
import Markdown from "./Markdown";
import MapView from "./MapView";
import Panel from "./Panel";
import { SessionReader } from "./Sessions";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [offline, setOffline] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      api
        .state()
        .then((s) => {
          if (stop) return;
          setState(s);
          setOffline(false);
        })
        .catch(() => !stop && setOffline(true));
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const goTo = useCallback((id: string | null) => {
    setFocus(id);
    setSuggestionId(null);
  }, []);
  const showError = useCallback((message: string) => setError(message), []);

  const start = async (topic: string) => {
    setStarting(true);
    setError(null);
    try {
      const s = await api.start(topic);
      setNewTopic(null);
      setSuggestionId(null);
      setProfile(null);
      setFolder(s.folder);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  if (!state) {
    return <div className="empty">{offline ? "Can't reach the server. Is it running?" : "Loading…"}</div>;
  }

  const trail = focus ? pathTo(state.map, focus) : [];
  const suggestion = state.map.suggestions.find((s) => s.id === suggestionId) ?? null;

  return (
    <div className="app">
      <header>
        <button className="brand link" onClick={() => { setFolder(null); setProfile(null); goTo(null); }}>
          AI teacher
        </button>
        <nav className="crumbs" aria-label="Where you are on the map">
          {!folder && profile === null && (
            <>
              <button className="link" onClick={() => goTo(null)} disabled={!focus}>
                All fields
              </button>
              {trail.map((t, i) => (
                <span key={t.id}>
                  <span className="sep">/</span>
                  <button className="link" onClick={() => goTo(t.id)} disabled={i === trail.length - 1}>
                    {t.name}
                  </button>
                </span>
              ))}
            </>
          )}
        </nav>
        <button
          onClick={() => {
            setFolder(null);
            api.profile().then((p) => setProfile(p.text)).catch((e) => setError(e.message));
          }}
        >
          Profile
        </button>
        <button className="primary" onClick={() => setNewTopic("")}>
          New session
        </button>
      </header>

      {offline && <div className="banner">Can't reach the server. Showing the last known state.</div>}
      {error && (
        <div className="banner" role="alert">
          {error}
          <button className="link" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <main>
        {folder ? (
          <SessionReader folder={folder} onClose={() => setFolder(null)} onOpen={setFolder} onError={showError} />
        ) : profile !== null ? (
          <div className="reader">
            <button className="link back" onClick={() => setProfile(null)}>
              ← Back to the map
            </button>
            <Markdown text={profile} />
          </div>
        ) : (
          <MapView
            map={state.map}
            focus={focus}
            selectedSuggestion={suggestionId}
            onFocus={goTo}
            onSuggestion={setSuggestionId}
          />
        )}
        <Panel
          map={state.map}
          sessions={state.sessions}
          explore={state.explore}
          focus={focus}
          suggestion={suggestion}
          onFocus={(id) => { setFolder(null); setProfile(null); goTo(id); }}
          onSuggestion={(id) => { setFolder(null); setProfile(null); setSuggestionId(id); }}
          onOpenSession={(f) => { setProfile(null); setSuggestionId(null); setFolder(f); }}
          onStart={start}
          onStarted={(f) => { setProfile(null); setSuggestionId(null); setFolder(f); }}
          onError={showError}
        />
      </main>

      {newTopic !== null && (
        <div className="overlay" onClick={() => setNewTopic(null)}>
          <form
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void start(newTopic);
            }}
          >
            <h2>What do you want to learn?</h2>
            <input
              autoFocus
              value={newTopic}
              placeholder="Optional. The teacher will ask if you leave it empty."
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setNewTopic(null)}
            />
            <div className="actions end">
              <button type="button" onClick={() => setNewTopic(null)}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={starting}>
                {starting ? "Starting…" : "Start session"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
