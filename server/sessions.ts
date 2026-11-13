import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { learningDir, sessionsDir } from "../shared/env.js";
import { slug } from "../shared/map.js";
import type { NewSessionOrigin, SessionDetail, SessionRecord, SessionSummary } from "../shared/types.js";
import { config } from "./config.js";
import {
  HttpError,
  listArtifacts,
  listFolders,
  readRecord,
  readText,
  sessionDir,
  updateRecord,
  writeRecord,
} from "./data.js";
import * as tmux from "./tmux.js";

const URL_PATTERN = /https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+/;
const TRUST_PATTERN = /Is this a project you created or one you trust/;
const WRAP_UP_MESSAGE = "Let's wrap up this session.";

async function summarize(record: SessionRecord): Promise<SessionSummary> {
  return {
    ...record,
    running: await tmux.alive(record.tmuxSession),
    wrappedUp: Boolean(record.wrappedUpAt) || existsSync(path.join(sessionsDir, record.folder, "summary.md")),
  };
}

export async function listSessions() {
  const records = await Promise.all((await listFolders()).map(readRecord));
  const sessions = await Promise.all(records.map(summarize));
  return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSession(folder: string): Promise<SessionDetail> {
  const dir = sessionDir(folder);
  const record = await readRecord(folder);
  const related = record.origin && !record.origin.unrelated ? record.origin.from : null;
  const all = await listSessions();
  return {
    session: await summarize(record),
    notesVersion: await fs
      .stat(path.join(dir, "notes.html"))
      .then((s) => String(s.mtimeMs))
      .catch(() => null),
    summary: await readText(path.join(dir, "summary.md")),
    notes: await readText(path.join(dir, "notes.md")),
    artifacts: await listArtifacts(folder),
    parent: all.find((s) => s.folder === related) ?? null,
    children: all.filter((s) => s.origin?.from === folder && !s.origin.unrelated),
  };
}

/** A new folder name like 2026-11-03_reinforcement_learning, numbered if that one is taken. */
function newFolderName(topic: string) {
  const date = new Date().toISOString().slice(0, 10);
  const base = `${date}_${slug(topic).slice(0, 60).replace(/_+$/, "") || "new_topic"}`;
  let name = base;
  for (let i = 2; existsSync(path.join(sessionsDir, name)); i++) name = `${base}_${i}`;
  return name;
}

async function systemPrompt(folder: string) {
  const rules = await fs.readFile(config.teacherRulesFile, "utf8");
  return rules
    .replaceAll("{{LEARNING_DIR}}", learningDir)
    .replaceAll("{{SESSION}}", folder)
    .replaceAll("{{SESSION_DIR}}", path.join(sessionsDir, folder))
    .replaceAll("{{MAP}}", `node ${config.mapCli}`)
    .replaceAll("{{NOTES_TEMPLATE}}", config.notesTemplate)
    .replaceAll("{{SESSION_CLI}}", `node ${config.sessionCli}`);
}

/** The Claude Code arguments shared by starting and resuming a session. */
async function claudeArgs(record: SessionRecord) {
  const settings = {
    permissions: {
      // What every lesson needs, so these never interrupt it with a prompt.
      allow: [
        `Bash(node ${config.mapCli}:*)`,
        `Bash(node ${config.sessionCli}:*)`,
        `Edit(/${learningDir}/**)`,
        `Write(/${learningDir}/**)`,
        // Publishing the notes to claude.ai, at the end of every step.
        "Artifact",
      ],
    },
  };
  return [
    // So bin/map.ts, run by the session, uses this same folder whatever .env says.
    "env", `LEARNING_DIR=${learningDir}`,
    config.claudeBin,
    "--remote-control", record.title,
    "--name", record.title,
    "--permission-mode", "auto",
    "--add-dir", learningDir,
    "--settings", JSON.stringify(settings),
    "--append-system-prompt", await systemPrompt(record.folder),
    ...(config.model ? ["--model", config.model] : []),
  ];
}

/** The CLI prints the session's link in the Claude app shortly after starting. Saves it when it does. */
async function captureUrl(record: SessionRecord) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const screen = await tmux.capture(record.tmuxSession).catch(() => "");
    const url = screen.match(URL_PATTERN)?.[0];
    if (url) {
      await updateRecord(record.folder, { url, problem: null });
      return;
    }
    // A new learning folder stops at Claude Code's trust check. That's for you to answer, not this server.
    if (TRUST_PATTERN.test(screen)) {
      await updateRecord(record.folder, {
        problem: `Claude Code is waiting for you to trust this folder. Run claude once in ${learningDir}, accept, then End this session and start it again.`,
      });
      return;
    }
  }
  console.error(`No Claude app link appeared for ${record.folder}`);
}

/** The first message: the topic, and for a session started from another one, what carries over. */
async function firstMessage(topic: string, origin: NewSessionOrigin | null) {
  if (!topic) return "Hi, I'd like to learn something new.";
  const ask = `I want to learn about: ${topic}`;
  if (!origin) return ask;
  if (origin.unrelated) {
    return `${ask}\n\n(Started from another of my sessions, but unrelated to it: don't assume any connection.)`;
  }
  const from = await readRecord(origin.from);
  const title = from.title.replace(/^Learn: /, "");
  return `${ask}\n\nStarted from my session "${title}" (${from.folder}).${origin.context ? `\nNote from that session's teacher: ${origin.context}` : ""}`;
}

export async function startSession(topic: string, origin: NewSessionOrigin | null = null) {
  if (origin) sessionDir(origin.from);
  const folder = newFolderName(topic);
  const dir = path.join(sessionsDir, folder);
  await fs.mkdir(path.join(dir, "artifacts"), { recursive: true });
  await fs.copyFile(config.notesTemplate, path.join(dir, "notes.html"));
  const record: SessionRecord = {
    folder,
    claudeSessionId: randomUUID(),
    title: `Learn: ${topic.slice(0, 60) || "new topic"}`,
    createdAt: new Date().toISOString(),
    tmuxSession: `ait-${folder}`,
    url: null,
    problem: null,
    origin: origin && { from: origin.from, unrelated: origin.unrelated },
  };
  // The first message gets the teacher talking, so the conversation is waiting for you in the app.
  const first = await firstMessage(topic, origin);
  await writeRecord(path.join(dir, "session.json"), record);
  await tmux.newSession(record.tmuxSession, dir, [
    ...(await claudeArgs(record)),
    "--session-id", record.claudeSessionId,
    first,
  ]);
  void captureUrl(record);
  return summarize(record);
}

/** Brings a stopped session back with its history. Its link in the Claude app stays the same. */
export async function resumeSession(folder: string) {
  const record = await readRecord(folder);
  if (await tmux.alive(record.tmuxSession)) throw new HttpError(409, "This session is already running");
  await tmux.newSession(record.tmuxSession, sessionDir(folder), [
    ...(await claudeArgs(record)),
    "--resume", record.claudeSessionId,
  ]);
  void captureUrl(record);
  return summarize(record);
}

export async function wrapUpSession(folder: string) {
  const record = await readRecord(folder);
  if (!(await tmux.alive(record.tmuxSession))) throw new HttpError(409, "Resume this session first");
  await tmux.sendText(record.tmuxSession, WRAP_UP_MESSAGE);
}

export async function endSession(folder: string) {
  const record = await readRecord(folder);
  if (await tmux.alive(record.tmuxSession)) await tmux.kill(record.tmuxSession);
}

/** Saves the claude.ai link the teacher published the notes to. */
export async function setNotesUrl(folder: string, url: string) {
  if (!/^https:\/\/claude\.ai\/[\w\-/]+$/.test(url)) throw new HttpError(400, "That isn't a claude.ai artifact link");
  await readRecord(folder);
  await updateRecord(folder, { notesUrl: url });
}

export async function markWrappedUp(folder: string) {
  await readRecord(folder);
  await updateRecord(folder, { wrappedUpAt: new Date().toISOString() });
}

/** The file's real path if it's inside the session's artifacts/ folder (links can't lead out of it). */
export async function artifactPath(folder: string, relative: string) {
  const root = await fs.realpath(path.join(sessionDir(folder), "artifacts")).catch(() => null);
  const file = root && (await fs.realpath(path.join(root, relative)).catch(() => null));
  if (!root || !file || !file.startsWith(root + path.sep)) throw new HttpError(404, "No such artifact");
  return file;
}
