import { useMemo } from "react";
import { childrenOf, LEVELS, type KnowledgeMap, type Suggestion } from "../../shared/map";
import type { ExploreList } from "../../shared/explore";
import type { SessionSummary } from "../../shared/types";
import Explore from "./Explore";
import { SessionRow } from "./Sessions";

/** What's beside the map: details of the topic or suggestion in view, and its sessions. */
export default function Panel({
  map,
  sessions,
  explore,
  focus,
  suggestion,
  onFocus,
  onSuggestion,
  onOpenSession,
  onStart,
  onStarted,
  onError,
}: {
  map: KnowledgeMap;
  sessions: SessionSummary[];
  explore: ExploreList;
  focus: string | null;
  suggestion: Suggestion | null;
  onFocus: (id: string | null) => void;
  onSuggestion: (id: string) => void;
  onOpenSession: (folder: string) => void;
  onStart: (topic: string) => void;
  onStarted: (folder: string) => void;
  onError: (message: string) => void;
}) {
  const children = useMemo(() => childrenOf(map), [map]);
  const topic = map.topics.find((t) => t.id === focus);

  // This topic's sessions and those of everything beneath it.
  const shown = useMemo(() => {
    if (!topic) return sessions;
    const folders = new Set<string>();
    const visit = (id: string) => {
      map.topics.find((t) => t.id === id)?.sessions.forEach((s) => folders.add(s));
      children.get(id)?.forEach((c) => visit(c.id));
    };
    visit(topic.id);
    return sessions.filter((s) => folders.has(s.folder));
  }, [topic, sessions, map, children]);

  const suggestions = topic ? map.suggestions.filter((s) => s.near === topic.id) : map.suggestions;
  const kids = topic ? (children.get(topic.id) ?? []) : [];
  const nameOf = (id: string) => map.topics.find((t) => t.id === id)?.name ?? id;
  const related = topic
    ? [...new Set([...topic.related, ...map.topics.filter((t) => t.related.includes(topic.id)).map((t) => t.id)])]
    : [];

  return (
    <aside className="panel">
      {suggestion && (
        <section className="suggestion-card">
          <div className="eyebrow">Suggested next</div>
          <h2>{suggestion.name}</h2>
          <p>{suggestion.reason}</p>
          <button className="primary" onClick={() => onStart(suggestion.name)}>
            Start a session on this
          </button>
        </section>
      )}

      {topic ? (
        <section>
          <h2>{topic.name}</h2>
          {topic.score === null ? (
            <p className="muted">{kids.length ? "Not scored on its own. Its size comes from the topics inside." : "Not scored yet."}</p>
          ) : (
            <>
              <div className="score" role="img" aria-label={`${topic.score} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={n <= topic.score! ? "pip on" : "pip"} />
                ))}
                <span className="score-text">
                  {topic.score}/5 · {LEVELS[topic.score]}
                </span>
              </div>
              {topic.reason && <p>{topic.reason}</p>}
            </>
          )}
          <button onClick={() => onStart(topic.name)}>Learn more about this</button>
        </section>
      ) : (
        <section>
          <h2>What you know</h2>
          <p className="muted">
            A bigger, more solid dot means you know more. Click a dot to look inside it. Scores come from your
            sessions, and you can correct them by telling the teacher.
          </p>
        </section>
      )}

      {kids.length > 0 && (
        <section>
          <h3>Inside</h3>
          {kids.map((c) => (
            <button key={c.id} className="row" onClick={() => onFocus(c.id)}>
              <span className="row-main">{c.name}</span>
              <span className="row-side">{c.score === null ? "–" : `${c.score}/5`}</span>
            </button>
          ))}
        </section>
      )}

      {related.length > 0 && (
        <section>
          <h3>Related</h3>
          {related.map((id) => (
            <button key={id} className="row" onClick={() => onFocus(id)}>
              <span className="row-main">{nameOf(id)}</span>
            </button>
          ))}
        </section>
      )}

      {suggestions.length > 0 && (
        <section>
          <h3>Suggestions</h3>
          {suggestions.map((s) => (
            <button key={s.id} className="row" onClick={() => onSuggestion(s.id)}>
              <span className="hollow" aria-hidden />
              <span className="row-main">{s.name}</span>
              {!topic && <span className="row-side">near {nameOf(s.near)}</span>}
            </button>
          ))}
        </section>
      )}

      <Explore
        explore={explore}
        sessions={sessions}
        onOpenSession={onOpenSession}
        onStarted={onStarted}
        onError={onError}
      />

      <section>
        <h3>{topic ? "Sessions" : "All sessions"}</h3>
        {shown.length === 0 && <p className="muted">None yet.</p>}
        {shown.map((s) => (
          <SessionRow key={s.folder} session={s} onOpen={onOpenSession} />
        ))}
      </section>
    </aside>
  );
}
