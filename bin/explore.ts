#!/usr/bin/env node
// How teaching sessions add to the learner's list of subjects to explore later. Changes are locked
// and atomic, since the web app changes the same file.
//
//   node bin/explore.ts add --subject "Bayes' theorem" --note "..." --session <this session's folder>
//   node bin/explore.ts list

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { exploreFile, sessionsDir } from "../shared/env.ts";
import { emptyExplore, findOpen, newItem } from "../shared/explore.ts";
import { changeJson, readJson } from "../shared/store.ts";

process.on("uncaughtException", (e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});

const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    subject: { type: "string" },
    note: { type: "string" },
    session: { type: "string" },
  },
});

switch (positionals[0]) {
  case "list": {
    const { items } = readJson(exploreFile, emptyExplore);
    const open = items.filter((i) => !i.started);
    if (!open.length) console.log("The list is empty.");
    for (const i of open) console.log(`- ${i.subject}${i.note ? `  (${i.note})` : ""}${i.from ? `  from ${i.from}` : ""}`);
    break;
  }

  case "add": {
    if (!a.subject?.trim() || !a.session) throw new Error("add needs --subject and --session <this session's folder>");
    if (!fs.existsSync(path.join(sessionsDir, path.basename(a.session), "session.json"))) {
      throw new Error(`no session "${a.session}"`);
    }
    const added = changeJson(
      exploreFile,
      emptyExplore,
      (list) => {
        const existing = findOpen(list, a.subject!);
        if (existing) return false;
        list.items.push(newItem(a.subject!, a.note ?? "", path.basename(a.session!)));
        return true;
      },
      "the explore list",
    );
    console.log(added ? `Added "${a.subject!.trim()}" to the explore list.` : `"${a.subject!.trim()}" is already on the explore list.`);
    break;
  }

  default:
    throw new Error("commands: add, list");
}
