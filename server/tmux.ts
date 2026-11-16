import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { repoDir } from "../shared/env.js";

// Sessions run in tmux so they outlive this server, and so Wrap up can type into them.

const run = promisify(execFile);
const launcher = path.join(repoDir, "bin", "launch.ts");

async function tmux(...args: string[]) {
  const { stdout } = await run("tmux", args, { maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}

/**
 * Starts a detached tmux session running argv. The command goes through bin/launch.ts in a file,
 * because tmux refuses long command lines and a session's carries all of teacher-rules.md.
 */
export async function newSession(name: string, cwd: string, argv: string[]) {
  const dir = path.join(os.tmpdir(), "ai-teacher");
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${name}-${Date.now()}.json`);
  await fs.writeFile(file, JSON.stringify(argv), { mode: 0o600 });
  try {
    // Arguments are passed as-is, never through a shell.
    await tmux("new-session", "-d", "-s", name, "-c", cwd, "-x", "200", "-y", "50", "--",
      process.execPath, launcher, file);
  } catch (e) {
    await fs.rm(file, { force: true });
    throw e;
  }
}

export async function alive(name: string) {
  try {
    await tmux("has-session", "-t", `=${name}`);
    return true;
  } catch {
    return false;
  }
}

/** The session's screen and scrollback. */
export async function capture(name: string) {
  return tmux("capture-pane", "-p", "-S", "-", "-t", `=${name}:`);
}

/** Types text into the prompt as a paste, then presses Enter. */
export async function sendText(name: string, text: string) {
  const target = `=${name}:`;
  const buffer = `ai-teacher-${name}`;
  await tmux("set-buffer", "-b", buffer, "--", text);
  await tmux("paste-buffer", "-p", "-d", "-b", buffer, "-t", target);
  // Give the CLI a moment to take the paste before submitting it.
  await new Promise((r) => setTimeout(r, 150));
  await tmux("send-keys", "-t", target, "Enter");
}

export async function kill(name: string) {
  await tmux("kill-session", "-t", `=${name}`);
}
