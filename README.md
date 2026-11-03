# AI teacher

A tool to help me learn new topics faster.

AI knows a lot of stuff but is not always the best at teaching it to someone that doesn't know it. It tends to give very long responses covering a lot of topics and has trouble determining the level of detail the user wants. This project aims to better guide an AI agent in teaching new topics.

## What it does

- **New session** starts a Claude Code session with teaching rules (`teacher-rules.md`) and Remote
  Control on. You talk to it in the Claude app or at claude.ai/code. It asks what you want to learn
  and how deep to go, then teaches in short steps and checks your understanding as it goes.
- **A profile** records your background, how technical you are and how you like to learn. Every
  session reads it and improves it.
- **Each session has a folder** with its artifacts, notes and, when you wrap up, a summary: what you
  learnt, key definitions and the thought process.
- **The knowledge map** shows what you know as dots: fields, then topics inside them to any depth.
  A bigger, more solid dot means you know more. Click a dot to look inside it. The side panel has
  its score and why, its summaries, links back to its sessions in the Claude app, and suggestions of
  what to discover next, which also appear as hollow dots.

## Setup

You need Node.js 22.18 or newer, tmux, and Claude Code logged in with a plan that has Remote Control.

```bash
npm install
cp .env.example .env    # set LEARNING_DIR to where your learning data should live
```

Keep `LEARNING_DIR` outside this repository, so personal notes never get committed. Then run
`claude` once in that folder and accept the trust check, because sessions can't be started
unattended in a folder Claude Code doesn't trust. A folder inside one you've already trusted is fine.

```bash
npm start     # http://localhost:4318
npm run dev   # or, while changing the code: http://localhost:5174, reloads as you save
```

The server only listens on this computer and has no login, so don't expose it to a network without
adding one. Sessions keep running in tmux when it stops, and show up again when you restart it.
Keep this computer on while you learn: Claude runs here, and the app only shows the session.

## Using it

1. **New session**, or **Learn more about this** on a topic, or **Start a session on this** on a
   suggestion. The session's page has an **Open in Claude** link, and it also appears by name in the app.
2. Learn. Artifacts it makes are saved in the session's `artifacts/` folder and listed on its page.
3. Say "let's wrap up" in the chat, or press **Wrap up**. The teacher writes the summary, tells you
   its scores for you to correct, and updates the map, suggestions and profile. You can carry on
   afterwards and wrap up again; it updates the same summary.
4. **End** closes a session to free the machine. **Resume** brings it back with its history and the same link.

Scores go from 0 to 5: never encountered, heard of it, can explain the basics, can apply it, can
reason through unfamiliar problems, could teach it. They come from what you showed in the
conversation, not time spent. To change one, tell the teacher in any session. A dot's size is its
score plus half of what's inside it, so parents grow with their topics.

## Data

```
LEARNING_DIR/
  profile.md            what the teacher knows about you; edit it freely
  knowledge_map.json    topics, scores, suggestions; changed through bin/map.ts
  sessions/
    2026-11-03_monty_hall/
      session.json      the session's ids, title and app link
      notes.md          kept during the session
      summary.md        written at wrap up
      artifacts/
```

## How it's built

```
teacher-rules.md   how the agent teaches; added to every session's system prompt
bin/map.ts         the command sessions use to change the map: validated, locked, atomic
server/            Node + Express
  sessions.ts      starts, resumes, wraps up and ends sessions; captures the app link
  data.ts          reads the learning folder and creates its starting files
  tmux.ts          runs sessions in tmux, reads their screen and types into them
  index.ts         HTTP API
shared/            map calculations and types used by the server, UI and bin/map.ts
web/src/           React UI (Vite)
  MapView.tsx      the knowledge map
  Panel.tsx        topic details, suggestions, sessions
  Sessions.tsx     a session's summary, notes, artifacts and controls
```

The app link is read from the session's screen in tmux, so a Claude Code update could change how
that works. If **Open in Claude** stops appearing, find the session by name in the app and check
`URL_PATTERN` in `server/sessions.ts`.

## Troubleshooting

- **A session says it's waiting for you to trust the folder:** run `claude` once in `LEARNING_DIR`,
  accept, then **End** the session and start it again.
- **A new session fails with a tmux error:** install tmux, and check that `tmux ls` works where you
  started the server.
- **A session shows an authentication error:** run `claude` in a terminal and log in again.
