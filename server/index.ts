import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { profileFile } from "../shared/env.js";
import type { AppState } from "../shared/types.js";
import { config } from "./config.js";
import { ensureData, HttpError, readMap, readText } from "./data.js";
import {
  artifactPath,
  endSession,
  getSession,
  listSessions,
  resumeSession,
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
  const state: AppState = { map: await readMap(), sessions: await listSessions() };
  res.json(state);
}));

app.get("/api/profile", h(async (_req, res) => {
  res.json({ text: (await readText(profileFile)) ?? "" });
}));

app.post("/api/sessions", h(async (req, res) => {
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  res.json(await startSession(topic));
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
