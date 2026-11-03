import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { learningDir, repoDir } from "../shared/env.js";

/** Full path to the `claude` command, so tmux finds it whatever its own PATH is. */
function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const dirs = [...(process.env.PATH ?? "").split(path.delimiter), path.join(os.homedir(), ".local", "bin")];
  for (const dir of dirs) {
    const candidate = path.join(dir, "claude");
    if (dir && fs.existsSync(candidate)) return candidate;
  }
  return "claude";
}

export const config = {
  learningDir,
  port: Number(process.env.PORT || 4318),
  model: process.env.CLAUDE_MODEL || undefined,
  claudeBin: findClaude(),
  /** Rules every teaching session gets in its system prompt. */
  teacherRulesFile: path.join(repoDir, "teacher-rules.md"),
  mapCli: path.join(repoDir, "bin", "map.ts"),
  dist: path.join(repoDir, "dist"),
};
