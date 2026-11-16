import type { AppState, SessionDetail, SessionSummary } from "../../shared/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

const post = <T,>(url: string, body?: unknown) =>
  request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

const at = (folder: string) => `/api/sessions/${encodeURIComponent(folder)}`;

export const api = {
  state: () => request<AppState>("/api/state"),
  profile: () => request<{ text: string }>("/api/profile"),
  session: (folder: string) => request<SessionDetail>(at(folder)),
  start: (topic: string) => post<SessionSummary>("/api/sessions", { topic }),
  addSubject: (subject: string, note: string) => post("/api/explore", { subject, note }),
  removeSubject: (id: string) => post(`/api/explore/${encodeURIComponent(id)}/remove`),
  startSubject: (id: string) => post<SessionSummary>(`/api/explore/${encodeURIComponent(id)}/start`),
  resume: (folder: string) => post<SessionSummary>(`${at(folder)}/resume`),
  wrapUp: (folder: string) => post(`${at(folder)}/wrapup`),
  end: (folder: string) => post(`${at(folder)}/end`),
  notesUrl: (folder: string, version: string) => `${at(folder)}/notes?v=${encodeURIComponent(version)}`,
  artifactUrl: (folder: string, file: string) =>
    `${at(folder)}/artifacts/${file.split("/").map(encodeURIComponent).join("/")}`,
};
