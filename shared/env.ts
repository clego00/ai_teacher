import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, wherever the command was started from. */
export const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env loader so you don't need an extra dependency.
const envFile = path.join(repoDir, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function expandHome(p: string) {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

export const learningDir = path.resolve(expandHome(process.env.LEARNING_DIR || "~/learning"));
export const mapFile = path.join(learningDir, "knowledge_map.json");
export const exploreFile = path.join(learningDir, "explore.json");
export const profileFile = path.join(learningDir, "profile.md");
export const sessionsDir = path.join(learningDir, "sessions");
