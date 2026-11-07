# RestLab

RestLab is a browser-based workspace for practicing HTTP and REST by writing and running JavaScript requests against a built-in Snippets API. Each browser has its own anonymous workspace with saved snippets and a saved `api.js` file.

## Planned capabilities

- Write and run `api.js` with familiar JavaScript `fetch`, Promises, and `async`/`await`.
- Inspect Console output and actual API requests and responses.
- Manage snippets through the API or the My APIs interface.
- Load bundled request examples and get concise HTTP and REST notes while working.
- Keep an anonymous workspace per browser; inactive workspaces are scheduled for deletion after 30 days.

## Technology decisions

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, and CodeMirror 6.
- **Backend:** Express 5 with TypeScript.
- **Database:** PostgreSQL through Prisma ORM 7 and Prisma Migrate.
- **User-code runtime:** A dedicated browser Web Worker with restricted network access.

## Project documents

- [Product requirements](docs/PRD.md)
- [Design and UX](docs/DESIGN.md)
- [Application flows](docs/APP_FLOW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API contract](docs/API.md)
- [Data schema](docs/SCHEMA.md)
- [Implementation tasks](docs/TASKS.md)
- [AI agent instructions](AGENTS.md)

## Local setup

The frontend and backend are separate projects. Start each in its own terminal.

### Backend and database

Install PostgreSQL locally and create a database and application role. The role needs permission to create a temporary shadow database for `prisma migrate dev` during local development. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL` for your local PostgreSQL role and `rest_lab` database. `APP_ORIGIN` must exactly match the frontend origin; the local default is `http://localhost:5173`. Keep `.env` private and do not commit credentials. The server requires a valid `DATABASE_URL` and `APP_ORIGIN` and exits with a setting-specific message when either is missing or invalid.

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run dev
```

Use `npm run db:generate` to regenerate Prisma Client, `npm run db:status` to inspect migration status, and `npm run db:migrate:deploy` to apply committed migrations without creating a shadow database.

In a second terminal, start the frontend:

```powershell
cd client
npm install
npm run dev
```

The Vite development server proxies `/api` requests to the backend on port `3001`, keeping local browser requests on the configured app origin.

The backend listens on port `3001` by default. `GET http://localhost:3001/health` returns `{ "status": "ok" }`. Set `PORT` to use a different port.

Create a frontend production build with `npm run build` and preview it locally with `npm run preview` from `client/`. Build the backend with `npm run build` and start the compiled server with `npm start` from `server/`.

## Frontend checks

Run unit tests with `npm run test` and lint with `npm run lint` from `client/`.

For browser tests, start the frontend with `npm run dev` in one terminal, then run `npm run test:e2e` in a second terminal. Playwright currently uses Chromium.

## Status

Implementation has started with the frontend, Express server, and Prisma database foundations in `client/` and `server/`. Anonymous workspace initialization, starter data, `api.js` persistence, inactivity tracking, and scheduled cleanup are implemented; Snippets API operations and the user interface remain in progress. Follow [TASKS.md](docs/TASKS.md) for milestone order and completion status; deployment configuration is still pending.
