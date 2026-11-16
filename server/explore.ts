import { exploreFile } from "../shared/env.js";
import { emptyExplore, findOpen, newItem, type ExploreList } from "../shared/explore.js";
import { changeJson, readJson } from "../shared/store.js";
import { HttpError, readRecord } from "./data.js";
import { startSession } from "./sessions.js";

// The learner's list of subjects to explore later. Sessions add to it through bin/explore.ts, the
// web app adds, removes and starts from it here; both go through the same lock.

const change = <R>(fn: (list: ExploreList) => R) => changeJson(exploreFile, emptyExplore, fn, "the explore list");

export const readExplore = () => readJson(exploreFile, emptyExplore);

export function addSubject(subject: string, note: string) {
  if (!subject.trim()) throw new HttpError(400, "Give a subject");
  return change((list) => {
    if (findOpen(list, subject)) throw new HttpError(409, `"${subject.trim()}" is already on the list`);
    const item = newItem(subject, note, null);
    list.items.push(item);
    return item;
  });
}

export function removeSubject(id: string) {
  change((list) => {
    list.items = list.items.filter((i) => i.id !== id);
  });
}

/** Starts a lesson on the subject, carrying its note and where it came up, and marks it started. */
export async function startSubject(id: string) {
  const item = readExplore().items.find((i) => i.id === id);
  if (!item) throw new HttpError(404, "That subject isn't on the list any more");
  if (item.started) throw new HttpError(409, "A session has already been started from this");
  // A session that has since been deleted just means no origin.
  const from = item.from && (await readRecord(item.from).then(() => item.from, () => null));
  const session = from
    ? await startSession(item.subject, { from, unrelated: false, context: item.note || undefined })
    : await startSession(item.subject, null, item.note);
  change((list) => {
    const i = list.items.find((x) => x.id === id);
    if (i) i.started = session.folder;
  });
  return session;
}
