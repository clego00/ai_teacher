#!/usr/bin/env node
// How teaching sessions change the knowledge map, so two sessions can't corrupt it or each other's
// edits: every change is validated, made under a lock, and written atomically.
//
//   node bin/map.ts show
//   node bin/map.ts topic --name "Computer vision" --parent machine_learning --score 2 --reason "..." --session <folder>
//   node bin/map.ts suggest --name "NLP" --near machine_learning --reason "..."
//   node bin/map.ts unsuggest --id nlp
//   node bin/map.ts title --session <folder> --title "Reinforcement learning basics"

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { mapFile, sessionsDir } from "../shared/env.ts";
import { childrenOf, seedMap, slug, type KnowledgeMap, type Topic } from "../shared/map.ts";
import { changeJson, readJson, writeJson } from "../shared/store.ts";

// A thrown error, not an exit, so a rejected change still releases the lock on its way out.
function fail(message: string): never {
  throw new Error(message);
}

process.on("uncaughtException", (e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});

const load = () => readJson(mapFile, seedMap);
const change = (fn: (map: KnowledgeMap) => void) => changeJson(mapFile, seedMap, fn, "the knowledge map");

function find(map: KnowledgeMap, id: string): Topic {
  return map.topics.find((t) => t.id === id) ?? fail(`no topic with id "${id}" (see: map.ts show)`);
}

function show() {
  const map = load();
  const children = childrenOf(map);
  const print = (t: Topic, depth: number) => {
    const score = t.score === null ? "-" : `${t.score}/5`;
    const related = t.related.length ? `  related: ${t.related.join(", ")}` : "";
    console.log(`${"  ".repeat(depth)}${t.id}  "${t.name}"  ${score}${t.reason ? `  (${t.reason})` : ""}${related}`);
    for (const c of children.get(t.id) ?? []) print(c, depth + 1);
  };
  for (const t of map.topics) if (!t.parent) print(t, 0);
  if (map.suggestions.length) console.log("\nSuggestions:");
  for (const s of map.suggestions) console.log(`  ${s.id}  "${s.name}"  near ${s.near}  (${s.reason})`);
}

const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: "string" },
    name: { type: "string" },
    parent: { type: "string" },
    field: { type: "boolean" },
    score: { type: "string" },
    reason: { type: "string" },
    session: { type: "string" },
    related: { type: "string", multiple: true },
    near: { type: "string" },
    title: { type: "string" },
  },
});

const now = new Date().toISOString();

switch (positionals[0]) {
  case "show":
    show();
    break;

  case "topic":
    change((map) => {
      const id = a.id ?? slug(a.name ?? "");
      if (!id) fail("topic needs --name, or --id for an existing topic");
      let t = map.topics.find((x) => x.id === id);
      if (!t) {
        if (!a.name) fail(`no topic with id "${id}"; give --name to create it`);
        if (!a.parent && !a.field) fail("a new topic needs --parent <id>, or --field for a new major field");
        t = { id, name: a.name, parent: null, score: null, reason: "", related: [], sessions: [], updatedAt: now };
        map.topics.push(t);
      } else if (a.name) {
        t.name = a.name;
      }
      if (a.parent) {
        // Walking up from the new parent must never reach the topic itself.
        for (let p: Topic | undefined = find(map, a.parent); p; p = p.parent ? find(map, p.parent) : undefined) {
          if (p.id === id) fail(`"${a.parent}" is "${id}" or beneath it, so it can't be its parent`);
        }
        t.parent = a.parent;
      }
      if (a.score !== undefined) {
        const score = Number(a.score);
        if (!Number.isInteger(score) || score < 0 || score > 5) fail("--score must be a whole number from 0 to 5");
        if (!a.reason) fail("--score needs a one-line --reason");
        t.score = score;
      }
      if (a.reason) t.reason = a.reason;
      for (const r of a.related ?? []) {
        if (find(map, r).id !== id && !t.related.includes(r)) t.related.push(r);
      }
      if (a.session && !t.sessions.includes(a.session)) t.sessions.push(a.session);
      t.updatedAt = now;
      // A topic that's now on the map no longer needs suggesting.
      map.suggestions = map.suggestions.filter((s) => s.id !== id);
    });
    break;

  case "suggest":
    change((map) => {
      if (!a.name || !a.near || !a.reason) fail("suggest needs --name, --near <id> and --reason");
      const id = slug(a.name);
      find(map, a.near);
      if (map.topics.some((t) => t.id === id)) fail(`"${id}" is already on the map`);
      map.suggestions = map.suggestions.filter((s) => s.id !== id);
      map.suggestions.push({ id, name: a.name, near: a.near, reason: a.reason, createdAt: now });
    });
    break;

  case "unsuggest":
    change((map) => {
      map.suggestions = map.suggestions.filter((s) => s.id !== a.id);
    });
    break;

  case "title": {
    if (!a.session || !a.title) fail("title needs --session <folder> and --title");
    const file = path.join(sessionsDir, path.basename(a.session), "session.json");
    if (!fs.existsSync(file)) fail(`no session "${a.session}"`);
    writeJson(file, { ...JSON.parse(fs.readFileSync(file, "utf8")), title: a.title });
    break;
  }

  default:
    fail("commands: show, topic, suggest, unsuggest, title");
}
if (positionals[0] && positionals[0] !== "show") console.log("ok");
