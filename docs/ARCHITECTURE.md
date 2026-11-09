# Architecture

## 1. Overview

RestLab is a browser application for writing and running JavaScript against its built-in Snippets API. The browser hosts the interface and runs user code in a dedicated Web Worker. An Express server owns the API and is the only application component that connects to PostgreSQL.

- **Architecture style:** Browser client, HTTP API, relational database.
- **Key constraints:** One anonymous workspace per browser; data is isolated by workspace. Keep deployment within free service limits; providers are not selected yet.

Product scope and interaction requirements are in [PRD.md](PRD.md) and [DESIGN.md](DESIGN.md). Persistent tables are defined in [SCHEMA.md](SCHEMA.md).

## 2. Technology stack

| Area               | Choice                                              | Notes                                                                                                  |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Frontend           | React, Vite, TypeScript, Tailwind CSS, CodeMirror 6 | Browser application; Tailwind is used for styling and CodeMirror 6 provides the `api.js` editor.       |
| User code runtime  | Browser JavaScript engine in a dedicated Web Worker | `api.js` remains JavaScript; it has no DOM or shell access.                                            |
| Backend            | Express 5 with TypeScript                           | Owns the Snippets API and all database access; uses Prisma ORM 7 for PostgreSQL access and migrations. |
| Database           | PostgreSQL                                          | Stores workspaces, snippets, and the workspace's `api.js`.                                             |
| Workspace identity | Random server-issued anonymous cookie               | Resolves to a workspace; clients do not choose workspace IDs.                                          |
| Testing            | Vitest, Supertest, Playwright                       | Unit, HTTP/API integration, and browser end-to-end coverage, including the Worker.                     |
| Hosting            | Undecided                                           | Free-only service constraint; provider choice is deferred.                                             |

## 3. System boundaries

```text
Browser
  +-- React / TypeScript interface
  +-- `api.js` editor (saved through the API)
  +-- Dedicated Web Worker (runs user JavaScript)
          | validated messages via `postMessage`
          v
      Browser request broker -- HTTP --> Express 5 API
          | workspace-scoped queries
          v
      PostgreSQL
```

The interface communicates with the Express API over HTTP. The Worker has no direct network access: it sends fetch requests to a browser-side broker using `postMessage`. The broker validates each request against the Snippets API route and method allowlist before sending it to the same-origin API, then returns a response to the Worker and records the request/response for the Network panel. Express derives workspace identity from the anonymous cookie, validates input, applies Snippets API behavior, and persists data. Neither the frontend nor Worker connects directly to PostgreSQL.

## 4. Modules and responsibilities

| Area                   | Responsibility                                                                                                                                | Boundary                                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser interface      | Workspace, Examples, and My APIs views; editor; results and notes panels.                                                                     | The application shell retains the active Worker and transient Console/Network results across view switches; results clear on reload. Shared read-only request examples are bundled with the frontend, not loaded from the server. The interface is not an authorization boundary. |
| User-code Worker       | Executes the single `api.js` file; forwards console output and brokered request/response events; enforces a run timeout and supports Stop.    | The application shell owns its lifecycle so switching app views does not terminate an active run. No DOM or shell. A restrictive CSP blocks direct network connections and nested workers; user `fetch` calls are mediated by the browser request broker. |
| Browser request broker | Validates Worker request messages, sends allowed requests to the same-origin Snippets API, returns responses, and records Network panel data in request start-time order. | Accepts only documented Snippets API routes and methods; rejects external URLs and app-support routes before network I/O. Uses the browser's session cookie without exposing its value to the Worker. |
| Express API            | Issues/resolves workspace identity, validates requests, applies Snippets API rules, and reads/writes persistent data.                         | All data operations are scoped to the workspace resolved from the cookie.                                                                                                                             |
| PostgreSQL             | Persists workspace records, snippets, and saved editor source.                                                                                | Accessed only by the Express application.                                                                                                                                                             |

The GUI for My APIs and calls made by user code use the same Snippets API endpoints and validation rules. This avoids separate behavior for the two ways of interacting with the API.

## 5. Key technical decisions

- **AD-01 - TypeScript application, JavaScript exercise file:** Build the product frontend and server with TypeScript. The user-authored file is plain JavaScript named `api.js`.
- **AD-02 - Anonymous per-browser workspace:** On first use, the server generates a 256-bit cookie token using a cryptographically secure random generator, stores only its lowercase hexadecimal SHA-256 hash, and issues the token in an HttpOnly, SameSite=Lax cookie. The persistent cookie expires after 30 days and is refreshed with workspace activity. Set Secure in production, where `APP_ORIGIN` must use HTTPS; local development uses HTTP without Secure. Require every `POST`, `PUT`, `PATCH`, and `DELETE` request to have an `Origin` matching the configured application origin; reject absent or mismatched origins with `403` before mutation. SameSite=Lax remains defense in depth. No account or user-selected workspace ID is involved.
- **AD-03 - Browser Worker runtime:** Run `api.js` in a dedicated Web Worker, not Node.js. A run has a 30-second limit and can be stopped. Serve the same-origin `/restlab-worker.js` response with CSP `default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'` so user JavaScript can be evaluated but cannot load scripts, make direct network connections, or create nested workers. Vite development and preview set this response header; the production host must preserve it. Provide a familiar `fetch` interface backed by a `postMessage` request broker. The supported request form takes a URL string and an optional plain-object init with `method`, `headers` (a plain object of string values), and `body` (a string or null); `Request` objects are unsupported. The broker accepts only the documented Snippets API routes and methods, rejects all other targets before network I/O, and never exposes the HttpOnly cookie value to user code. It uses the browser's same-origin session cookie automatically. Resolve allowed requests to a Response-compatible object exposing `status`, `ok`, and `headers`, plus `json()` and `text()` methods. Express still validates every request and scopes data using the cookie.
- **AD-04 - Shared API and persistence:** Express is the only database client. The GUI and `api.js` call the same HTTP API. The workspace's editor source is saved to PostgreSQL about one second after typing stops, with a Saving/Saved indicator. A stale or in-flight save must not overwrite newer editor contents, including when an example is loaded.
- **AD-05 - Inactivity cleanup:** Workspace visits and actions that read or change its data refresh activity. The Express process schedules cleanup at UTC midnight each day, independently of user requests, and deletes workspaces and their snippets when `last_activity_at` is at least 30 days old. The cookie lifetime is aligned with that period. Deployment must use a host that runs the server often enough for the scheduler to execute.
- **AD-06 - Free deployment constraint:** Choose hosting and database plans that can operate at no cost. If free quotas are exhausted, the app may pause or fail until quota is available; it must not silently require a paid upgrade. Provider selection is deferred.
- **AD-07 - Verification stack:** Use Vitest for unit tests, Supertest for Express HTTP/API integration tests, and Playwright for browser end-to-end tests, including Worker behavior.
- **AD-08 - PostgreSQL access and migrations:** Use Prisma ORM 7, including Prisma Client for typed database access and Prisma Migrate for schema changes. The Prisma schema is the executable database model and must stay aligned with the human-readable design in `SCHEMA.md`.
- **AD-09 - Request examples:** Bundle six shared JavaScript request examples with the frontend: list snippets (`GET`), retrieve one (`GET`), create (`POST`), replace (`PUT`), partially update (`PATCH`), and delete (`DELETE`). The single-record examples use a visible `snippetId` placeholder and tell users to replace it with an ID from My APIs before running. They are templates copied into the current workspace's saved `api.js` when loaded; users may load them in any order. They are not stored per workspace and do not require an API endpoint or database table.
- **AD-10 - Code editor:** Use CodeMirror 6, an MIT-licensed open-source editor, for the single `api.js` file. Configure only the agreed focused editing features: JavaScript syntax highlighting, line numbers, and basic editing; do not enable autocomplete, lint underlines, minimap, or file tabs.

## 6. Data and integration flow

### First visit and workspace access

1. The browser requests the application and makes its initial API request.
2. If no valid workspace cookie is present, Express creates a workspace, seeds its sample snippets and starter `api.js`, and returns a server-issued anonymous cookie.
3. On subsequent API calls, Express resolves the cookie to a workspace and scopes every query to that workspace. It never trusts a workspace ID supplied by client code.
4. Activity updates the workspace's last-activity time and refreshes the cookie. A daily server-side cleanup deletes workspaces whose last activity was at least 30 days ago, even if they have not been visited again.

### Snippet requests

1. The GUI or `api.js` sends an HTTP request to a Snippets API endpoint.
2. Express resolves the workspace, validates the method, path, parameters, and body, then applies the API's CRUD behavior.
3. Express reads or changes only records belonging to that workspace and returns the HTTP status and response body.
4. The browser displays the result. During a user-code run, console output and request/response details are also forwarded to the Console and Network panels. The application shell retains those run results in browser memory across view switches and clears them on reload.

### Saving `api.js`

The editor waits about one second after typing stops and sends the current source to the API. Express validates the request size and saves the source for the current workspace. The interface reflects the save state. This save is separate from running the code.

## 7. Cross-cutting requirements

- **Workspace access and CSRF protection:** Use the server-issued 256-bit token cookie with HttpOnly and SameSite=Lax. Set Secure in deployed HTTPS environments; local development may need environment-appropriate settings. Resolve and authorize workspace ownership on the server for every workspace data operation. Require an exact configured-Origin match for `POST`, `PUT`, `PATCH`, and `DELETE`; reject missing or mismatched origins before mutation.
- **Validation and integrity:** Treat request data, stored code, and user-run output as untrusted. Apply the PRD's snippet field and size limits on the server. Preserve workspace scoping in database queries and enforce record-level ownership for reads, updates, and deletes.
- **User code controls:** Apply a 30-second execution limit and a Stop control. Serve the Worker with CSP that blocks direct network connections and nested workers; allow user `fetch` through the broker only. The broker validates the URL origin, route, HTTP method, and message shape before forwarding a request; it rejects requests after the run ends. Do not expose cookie values, server credentials, or secrets to `api.js`.
- **Errors and logs:** Return understandable HTTP errors for validation and API failures. Keep console and network details in the browser's run view; avoid logging snippet contents, cookies, or other sensitive values on the server.
- **Configuration:** Load `DATABASE_URL`, `APP_ORIGIN`, `PORT`, and `NODE_ENV` from server-side environment configuration. `DATABASE_URL` and `APP_ORIGIN` are required; the server fails at startup with a clear setting-specific message if required configuration is missing or invalid. Use `server/.env` for local development and keep it ignored by Git. Never log connection credentials or bundle server configuration into frontend assets or user code. `APP_ORIGIN` is the exact frontend origin trusted by mutation-request Origin checks; production must set its deployed HTTPS origin explicitly.
- **Persistence and expiry:** PostgreSQL is the durable store. A scheduled server-side task runs daily and deletes workspaces inactive for at least 30 days; the foreign-key cascade deletes their snippets. The task runs independently of user requests.
- **Availability:** Free-tier limits may affect availability. Quota exhaustion can make the service unavailable; no paid fallback is assumed.

## 8. Open technical questions

- **Hosting and database provider:** Which free services will host the application and PostgreSQL? Provider selection is deferred while deployment is out of immediate scope.
- **Cookie and scheduler deployment:** Confirm production cookie domain/HTTPS settings and select a host that keeps the Express process running so its daily scheduler can execute; use a provider scheduler if the selected host suspends the process.
