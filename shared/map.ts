// The knowledge map: a tree of topics under a few major fields, plus suggested next topics.
// Types and calculations only, so the server, the UI and bin/map.ts can all use it.

export type Topic = {
  id: string;
  name: string;
  /** Null for the major fields. */
  parent: string | null;
  /** 0-5, set by the teacher from evidence in the conversation. Null when never scored. */
  score: number | null;
  /** One line on why it has that score. */
  reason: string;
  /** Topics elsewhere in the tree this one bridges to. */
  related: string[];
  /** Folders (under sessions/) of the sessions that touched this topic. */
  sessions: string[];
  updatedAt: string;
};

export type Suggestion = {
  id: string;
  name: string;
  /** The topic it would sit next to on the map. */
  near: string;
  reason: string;
  createdAt: string;
};

export type KnowledgeMap = { version: 1; topics: Topic[]; suggestions: Suggestion[] };

export const FIELDS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology & medicine",
  "Computer science",
  "Engineering",
  "Economics & business",
  "History & politics",
  "Philosophy & psychology",
  "Literature & arts",
];

export const LEVELS = [
  "Never encountered",
  "Heard of it",
  "Can explain the basics",
  "Can apply it",
  "Can reason through unfamiliar problems",
  "Could teach it",
];

export function slug(name: string) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function seedMap(now = new Date().toISOString()): KnowledgeMap {
  return {
    version: 1,
    topics: FIELDS.map((name) => ({
      id: slug(name),
      name,
      parent: null,
      score: null,
      reason: "",
      related: [],
      sessions: [],
      updatedAt: now,
    })),
    suggestions: [],
  };
}

/**
 * How much there is to show for each topic: its own score plus half of what's beneath it, so
 * learning a lot of machine learning grows both "machine learning" and its field.
 */
export function masses(map: KnowledgeMap) {
  const children = childrenOf(map);
  const out = new Map<string, number>();
  const visit = (t: Topic): number => {
    let total = t.score ?? 0;
    for (const c of children.get(t.id) ?? []) total += 0.5 * visit(c);
    out.set(t.id, total);
    return total;
  };
  for (const t of map.topics) if (!t.parent) visit(t);
  return out;
}

export function childrenOf(map: KnowledgeMap) {
  const out = new Map<string, Topic[]>();
  for (const t of map.topics) {
    if (!t.parent) continue;
    out.set(t.parent, [...(out.get(t.parent) ?? []), t]);
  }
  return out;
}

/** The topic's ancestors, nearest last, ending with the topic itself. */
export function pathTo(map: KnowledgeMap, id: string): Topic[] {
  const byId = new Map(map.topics.map((t) => [t.id, t]));
  const out: Topic[] = [];
  for (let t = byId.get(id); t && out.length < 64; t = t.parent ? byId.get(t.parent) : undefined) out.unshift(t);
  return out;
}
