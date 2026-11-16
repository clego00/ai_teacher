// Safe changes to the JSON files in the learning folder, which sessions and the server can change at
// the same time: every change is made under a lock and written atomically.

import fs from "node:fs";
import path from "node:path";

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

export function readJson<T>(file: string, seed: () => T): T {
  if (!fs.existsSync(file)) return seed();
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const STALE_LOCK_MS = 30_000;

/**
 * Loads the file, lets `fn` change it and writes it back, all while holding its lock (a directory,
 * since mkdir is atomic). If `fn` throws, nothing is written and the lock is still released.
 */
export function changeJson<T, R = void>(file: string, seed: () => T, fn: (data: T) => R, what = "this file"): R {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch {
      const stat = fs.statSync(lock, { throwIfNoEntry: false });
      if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) fs.rmSync(lock, { recursive: true, force: true });
      if (Date.now() > deadline) throw new Error(`${what} is locked by another session; try again`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try {
    const data = readJson(file, seed);
    const result = fn(data);
    writeJson(file, data);
    return result;
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}
