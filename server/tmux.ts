import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Sessions run in tmux so they outlive this server, and so Wrap up can type into them.

const run = promisify(execFile);

async function tmux(...args: string[]) {
  const { stdout } = await run("tmux", args, { maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}

/** Starts a detached tmux session running argv. */
export async function newSession(name: string, cwd: string, argv: string[]) {
  // Arguments after the command are passed to it as-is, never through a shell.
  await tmux("new-session", "-d", "-s", name, "-c", cwd, "-x", "200", "-y", "50", "--", ...argv);
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
