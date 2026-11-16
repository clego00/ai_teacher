// Subjects to explore later: the learner's own list, added to from lessons or the web app.

export type ExploreItem = {
  id: string;
  subject: string;
  /** Why it came up or why they want it: a line from the teacher, or their own note. */
  note: string;
  /** The session it came up in, if it was added during a lesson. */
  from: string | null;
  addedAt: string;
  /** The session started from it, once there is one. */
  started: string | null;
};

export type ExploreList = { version: 1; items: ExploreItem[] };

export const emptyExplore = (): ExploreList => ({ version: 1, items: [] });

/** An open entry for the same subject, so it isn't added twice. */
export function findOpen(list: ExploreList, subject: string) {
  const key = subject.trim().toLowerCase();
  return list.items.find((i) => !i.started && i.subject.trim().toLowerCase() === key);
}

export function newItem(subject: string, note: string, from: string | null): ExploreItem {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    subject: subject.trim(),
    note: note.trim(),
    from,
    addedAt: new Date().toISOString(),
    started: null,
  };
}
