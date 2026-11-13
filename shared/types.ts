import type { KnowledgeMap } from "./map.js";

/** What's saved in each session's session.json. */
export type SessionRecord = {
  /** The session's folder name under sessions/, which is also its id here. */
  folder: string;
  claudeSessionId: string;
  title: string;
  createdAt: string;
  tmuxSession: string;
  /** Link to the conversation in the Claude app, once the CLI has printed it. */
  url: string | null;
  /** Why the session can't get going, if something needs you. */
  problem?: string | null;
  /** The session it was started from, if a teacher started it during another lesson. */
  origin?: SessionOrigin | null;
  /** The notes published to claude.ai, so they open in the Claude app too. */
  notesUrl?: string | null;
  /** When the teacher last finished a wrap up. */
  wrappedUpAt?: string | null;
};

export type SessionOrigin = {
  /** Folder of the session it was started from. */
  from: string;
  /** Asked for as unrelated: nothing carried over, and no link shown between the two. */
  unrelated: boolean;
};

/** Where a new session comes from, as asked for when starting it. */
export type NewSessionOrigin = SessionOrigin & {
  /** One or two lines on why the learner wants the topic and how it connects. */
  context?: string;
};

export type SessionSummary = SessionRecord & {
  /** The CLI is running in tmux. */
  running: boolean;
  /** Wrapped up at least once (wrappedUpAt, or an old-style summary.md). */
  wrappedUp: boolean;
};

export type SessionDetail = {
  session: SessionSummary;
  /** Changes whenever notes.html does (its mtime), or null if there isn't one. */
  notesVersion: string | null;
  /** Old-style sessions, from before notes.html. */
  summary: string | null;
  notes: string | null;
  artifacts: string[];
  /** The session this one was started from, unless it was started as unrelated. */
  parent: SessionSummary | null;
  /** Related sessions started from this one. */
  children: SessionSummary[];
};

export type AppState = { map: KnowledgeMap; sessions: SessionSummary[] };
