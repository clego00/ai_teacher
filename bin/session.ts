#!/usr/bin/env node
// What a teaching session asks of the web app's server, which owns session.json.
//
// Start another session, which runs in tmux with Remote Control like any other. Prints its name and
// its link in the Claude app:
//   node bin/session.ts new --topic "Bayes' theorem" --from <this session's folder> --context "..."
//   node bin/session.ts new --topic "Medieval castles" --from <this session's folder> --unrelated
//
// Save the claude.ai link the notes were published to, and record a finished wrap up:
//   node bin/session.ts notes-link --session <this session's folder> --url https://claude.ai/...
//   node bin/session.ts wrapped-up --session <this session's folder>

import { parseArgs } from "node:util";
import "../shared/env.ts";

process.on("uncaughtException", (e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});

const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    topic: { type: "string" },
    from: { type: "string" },
    context: { type: "string" },
    unrelated: { type: "boolean" },
    session: { type: "string" },
    url: { type: "string" },
  },
});

const server = `http://127.0.0.1:${process.env.PORT || 4318}`;

async function call(path: string, body?: unknown) {
  const res = await fetch(server + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new Error(`the AI teacher server isn't running at ${server}; start it, then try again`);
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `the server answered ${res.status}`);
  return data;
}

const command = positionals[0];

if (command === "notes-link" || command === "wrapped-up") {
  if (!a.session) throw new Error(`${command} needs --session <this session's folder>`);
  if (command === "notes-link" && !a.url) throw new Error("notes-link needs --url <the notes' claude.ai link>");
  await call(`/api/sessions/${encodeURIComponent(a.session)}/${command}`, { url: a.url });
  console.log(command === "notes-link" ? "Saved the notes link." : "Marked as wrapped up.");
  process.exit(0);
}

if (command !== "new") throw new Error("commands: new, notes-link, wrapped-up");
if (!a.topic || !a.from) throw new Error("new needs --topic and --from <this session's folder>");
if (a.unrelated && a.context) throw new Error("an --unrelated session takes no --context");

const started = await call("/api/sessions", {
  topic: a.topic,
  from: a.from,
  unrelated: a.unrelated === true,
  context: a.context,
});

// The CLI prints its link in the Claude app a few seconds after starting.
for (let i = 0; i < 45; i++) {
  const { session } = await call(`/api/sessions/${encodeURIComponent(started.folder)}`);
  if (session.url || session.problem) {
    console.log(`Started "${session.title}" (${session.folder})`);
    console.log(session.url ? `Link: ${session.url}` : `Problem: ${session.problem}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(`Started "${started.title}" (${started.folder}). Its link isn't ready yet; it appears in the Claude app by that name.`);
