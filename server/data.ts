import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { mapFile, profileFile, sessionsDir } from "../shared/env.js";
import { seedMap, type KnowledgeMap } from "../shared/map.js";
import type { SessionRecord } from "../shared/types.js";

// The learning folder holds plain files that sessions edit too. The server only ever creates the
// starting files, and leaves changes to the map to bin/map.ts.

const PROFILE = `# Learner profile

Kept up to date by the teacher. Edit it yourself whenever it gets something wrong.

## Background

## How technical

## What I know well

## How I like to learn

## Things that worked or didn't
`;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function ensureData() {
  await fs.mkdir(sessionsDir, { recursive: true });
  if (!existsSync(profileFile)) await fs.writeFile(profileFile, PROFILE);
  if (!existsSync(mapFile)) await fs.writeFile(mapFile, JSON.stringify(seedMap(), null, 2) + "\n");
}

export async function readMap(): Promise<KnowledgeMap> {
  return JSON.parse(await fs.readFile(mapFile, "utf8"));
}

export async function readText(file: string) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

/** The folder of an existing session. `folder` comes from a URL, so it must be a plain name. */
export function sessionDir(folder: string) {
  const dir = path.join(sessionsDir, folder);
  if (!/^[a-z0-9_-]+$/.test(folder) || !existsSync(path.join(dir, "session.json"))) {
    throw new HttpError(404, "No such session");
  }
  return dir;
}

export async function readRecord(folder: string): Promise<SessionRecord> {
  return JSON.parse(await fs.readFile(path.join(sessionDir(folder), "session.json"), "utf8"));
}

/** Saves fields of a record on top of its latest version, since sessions set the title themselves. */
export async function updateRecord(folder: string, fields: Partial<SessionRecord>) {
  const file = path.join(sessionDir(folder), "session.json");
  const next = { ...JSON.parse(await fs.readFile(file, "utf8")), ...fields };
  await writeRecord(file, next);
}

export async function writeRecord(file: string, record: SessionRecord) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(record, null, 2) + "\n");
  await fs.rename(tmp, file);
}

export async function listFolders() {
  const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && existsSync(path.join(sessionsDir, e.name, "session.json")))
    .map((e) => e.name);
}

/** Files under the session's artifacts/ folder, as paths relative to it. */
export async function listArtifacts(folder: string) {
  const root = path.join(sessionDir(folder), "artifacts");
  if (!existsSync(root)) return [];
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(root, path.join(e.parentPath, e.name)))
    .sort();
}
