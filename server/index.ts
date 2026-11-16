import express from "express";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { profileFile } from "../shared/env.js";
import type { AppState } from "../shared/types.js";
import { config } from "./config.js";
import { addSubject, readExplore, removeSubject, startSubject } from "./explore.js";
import { ensureData, HttpError, readMap, readText, sessionDir } from "./data.js";
import {
  artifactPath,
  endSession,
  getSession,
  listSessions,
  markWrappedUp,
  resumeSession,
  setNotesUrl,
  startSession,
  wrapUpSession,
} from "./sessions.js";

const app = express();

// The server starts commands and has no login, so only pages it serves itself may use it. This
// stops other websites open in your browser from reaching it through localhost.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const originHost = origin ? origin.replace(/^https?:\/\//, "") : null;
  if (!LOCAL.test(req.headers.host ?? "") || (originHost !== null && !LOCAL.test(originHost))) {
    res.status(403).json({ error: "This server only accepts requests from this computer" });
    return;
  }
  next();
});
app.use(express.json());

const h =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) =>
    fn(req, res).catch(next);

const param = (req: express.Request, name: string) => String(req.params[name]);

app.get("/api/state", h(async (_req, res) => {
  const state: AppState = { map: await readMap(), sessions: await listSessions(), explore: readExplore() };
  res.json(state);
}));

app.get("/api/profile", h(async (_req, res) => {
  res.json({ text: (await readText(profileFile)) ?? "" });
}));

app.post("/api/sessions", h(async (req, res) => {
  const body = req.body ?? {};
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const from = typeof body.from === "string" ? body.from : null;
  if (from && !topic) throw new HttpError(400, "A session started from another one needs a topic");
  const origin = from
    ? {
        from,
        unrelated: body.unrelated === true,
        context: typeof body.context === "string" && body.unrelated !== true ? body.context.trim() : undefined,
      }
    : null;
  res.json(await startSession(topic, origin));
}));

app.post("/api/explore", h(async (req, res) => {
  const body = req.body ?? {};
  res.json(addSubject(String(body.subject ?? ""), String(body.note ?? "")));
}));

app.post("/api/explore/:id/remove", h(async (req, res) => {
  removeSubject(param(req, "id"));
  res.json({ ok: true });
}));

app.post("/api/explore/:id/start", h(async (req, res) => {
  res.json(await startSubject(param(req, "id")));
}));

app.get("/api/sessions/:folder", h(async (req, res) => {
  res.json(await getSession(param(req, "folder")));
}));

app.post("/api/sessions/:folder/resume", h(async (req, res) => {
  res.json(await resumeSession(param(req, "folder")));
}));

app.post("/api/sessions/:folder/wrapup", h(async (req, res) => {
  await wrapUpSession(param(req, "folder"));
  res.json({ ok: true });
}));

app.post("/api/sessions/:folder/end", h(async (req, res) => {
  await endSession(param(req, "folder"));
  res.json({ ok: true });
}));

app.post("/api/sessions/:folder/notes-link", h(async (req, res) => {
  await setNotesUrl(param(req, "folder"), String(req.body?.url ?? ""));
  res.json({ ok: true });
}));

app.post("/api/sessions/:folder/wrapped-up", h(async (req, res) => {
  await markWrappedUp(param(req, "folder"));
  res.json({ ok: true });
}));

// The skeleton claude.ai wraps a published page in, so the notes look the same here.
const PAGE_HEAD =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n';

// The notes are a page a session wrote, so they open sandboxed like artifacts (below).
app.get("/api/sessions/:folder/notes", h(async (req, res) => {
  const html = await fs.readFile(path.join(sessionDir(param(req, "folder")), "notes.html"), "utf8").catch(() => {
    throw new HttpError(404, "No notes yet");
  });
  res.setHeader("Content-Security-Policy", "sandbox allow-scripts allow-popups");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(PAGE_HEAD + html);
}));

// Artifacts are pages a session wrote, so they open sandboxed, unable to call this server as you.
app.get("/api/sessions/:folder/artifacts/*file", h(async (req, res) => {
  const relative = ([] as string[]).concat(req.params.file as string | string[]).join("/");
  res.setHeader("Content-Security-Policy", "sandbox allow-scripts allow-popups");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(await artifactPath(param(req, "folder"), relative));
}));

if (existsSync(config.dist)) {
  app.use(express.static(config.dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(config.dist, "index.html")));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (!(err instanceof HttpError)) console.error(err);
  res.status(err instanceof HttpError ? err.status : 500).json({ error: err.message });
});

await ensureData();
app.listen(config.port, "127.0.0.1", () => {
  console.log(`AI teacher on http://localhost:${config.port}, data in ${config.learningDir}`);
});
