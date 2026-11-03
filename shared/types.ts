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
};

export type SessionSummary = SessionRecord & {
  /** The CLI is running in tmux. */
  running: boolean;
  /** A summary.md exists. */
  wrappedUp: boolean;
};

export type SessionDetail = {
  session: SessionSummary;
  summary: string | null;
  notes: string | null;
  artifacts: string[];
};

export type AppState = { map: KnowledgeMap; sessions: SessionSummary[] };
