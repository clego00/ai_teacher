#!/usr/bin/env node
// Runs a command read from a JSON file, then deletes the file. tmux refuses commands over about
// 16 KB, and a session's command carries the whole of teacher-rules.md, so the server hands it over
// this way instead of on tmux's command line.
//
//   node bin/launch.ts <file with ["command", "arg", ...]>

import { spawn } from "node:child_process";
import fs from "node:fs";

const file = process.argv[2];
const argv: string[] = JSON.parse(fs.readFileSync(file, "utf8"));
fs.rmSync(file, { force: true });

// Ctrl-C belongs to the child (Claude Code reads it itself); this process just waits for it.
process.on("SIGINT", () => {});
const child = spawn(argv[0], argv.slice(1), { stdio: "inherit" });
child.on("error", (e) => {
  console.error(`error: couldn't start ${argv[0]}: ${e.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
