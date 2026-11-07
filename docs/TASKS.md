# Implementation Tasks

## How to use this plan

- Work through tasks in dependency order. Tasks within a milestone may proceed independently when their dependencies allow.
- Check off each item as it is completed. A task is complete when all of its checkboxes are checked.
- Update the relevant product or technical document if implementation changes an approved decision.

## Milestones

- **M1 - Foundation and data:** Local app foundation, database, anonymous session, and durable workspace data.
- **M2 - Snippets API:** Workspace-scoped API contract and its validation.
- **M3 - Workspace runner:** Editor, safe `api.js` execution, Console, and Network results.
- **M4 - Examples and My APIs:** Example loading and GUI snippet management.
- **M5 - Integration and readiness:** End-to-end verification, accessibility, responsive behavior, and local setup. Hosting-provider selection remains deferred.

## M1 - Foundation and data

#### T-01 - Create the frontend project foundation

- [x] Set up React, Vite, TypeScript, Tailwind CSS, and a basic application entry point.
- [x] Add local development and production build commands.
- [x] Configure Vitest and Playwright with runnable project scripts.

#### T-02 - Create the Express server foundation

- [x] Set up Express 5 and TypeScript with local development and production build commands.
- [x] Add a minimal route and configure Supertest to call it.
- [x] Keep API routes separate from frontend code.

#### T-03 - Set up Prisma ORM 7 and Prisma Migrate

- [x] Configure Prisma ORM 7 and Prisma Migrate for the TypeScript Express server.
- [x] Add the Prisma data model from `SCHEMA.md` and document how to keep the two aligned.
- [x] Add package scripts for generating the Prisma Client and running migrations.
- [x] Verify a local database connection and a minimal migration.

#### T-04 - Add server configuration and secret handling

- [x] Load database settings and environment-specific values on the server.
- [x] Configure the trusted RestLab application origin used to validate mutation requests.
- [x] Fail startup clearly when required configuration is missing.
- [x] Confirm secrets are absent from frontend assets and logs.

#### T-05 - Create the initial database migration

- [x] Create `workspaces` and `snippets` tables, keys, constraints, foreign key, and indexes from `SCHEMA.md`; do not add a separate `snippets.workspace_id` index because the composite indexes cover its leading column.
- [x] Configure workspace deletion to cascade to its snippets.
- [x] Apply the migration successfully to an empty local database.

#### T-06 - Implement workspace cookie creation and resolution

- [x] Generate a 256-bit cookie token with a cryptographically secure random generator, encode it as unpadded base64url, and store only its lowercase hexadecimal SHA-256 digest.
- [x] Resolve each valid cookie to its own workspace; do not accept a client-selected workspace ID.
- [x] Set HttpOnly and SameSite=Lax; set Secure in deployed HTTPS environments and use environment-appropriate settings locally.
- [x] Verify missing, valid, and invalid cookie behavior; ensure tokens are not logged or returned.

#### T-07 - Seed a new workspace with starter data

- [x] Create the approved starter GET `api.js` and the three seed snippets defined in `SCHEMA.md` (JavaScript, Python, and SQL) for a new workspace.
- [x] Give each workspace independent snippet records.
- [x] Verify each new workspace receives exactly those three records and that reusing a session does not duplicate or reseed them.

#### T-08 - Persist and load `api.js`

- [x] Implement `POST /api/session` to initialize or resolve the browser session and return saved source.
- [x] Implement `PUT /api/session/api-js` to accept raw `text/plain; charset=utf-8` source up to 1 MB UTF-8 and return the saved source as JSON.
- [x] Return `413` for source above 1 MB; return `415` for unsupported media types; verify a save/read round trip at the size boundary.

#### T-09 - Implement 30-day inactivity tracking and cleanup

- [x] Refresh `last_activity_at` on workspace data reads and writes.
- [x] Run a scheduled server-side cleanup daily, independently of user requests, deleting workspaces inactive for at least 30 days and cascading deletion to snippets.
- [x] Verify expired workspaces are deleted without a user visit, active workspaces remain available, and the expiry boundary is correct.

## M2 - Snippets API

#### T-10 - Add JSON limits and common API errors

- [ ] Limit JSON request bodies to 2 MB and reject unsupported content types, while honoring the plain-text media type and 1 MB UTF-8 limit for the editor save route.
- [ ] Return the documented structured error format for malformed and invalid requests.
- [ ] Require a matching `Origin` on `POST`, `PUT`, `PATCH`, and `DELETE`; reject missing or mismatched values with `403` before mutation.
- [ ] Return generic `500` errors without stack traces or internal details.
- [ ] Verify `400`, `403`, `413`, `415`, and `500` responses, including same-origin, missing-origin, and mismatched-origin mutations.

#### T-11 - Implement snippet validation

- [ ] Validate required fields, trimming, lengths, non-whitespace code, 100 KB UTF-8 code size, and UUID path values.
- [ ] Return field-level validation details where applicable.
- [ ] Verify invalid data never partially changes a record.

#### T-12 - Implement workspace-scoped snippet listing and retrieval

- [ ] Implement `GET /api/snippets` and `GET /api/snippets/{snippetId}`.
- [ ] Restrict results to the cookie's workspace; return `404` for missing or non-owned IDs.
- [ ] Verify isolation with at least two workspaces.

#### T-13 - Implement snippet creation

- [ ] Implement `POST /api/snippets` with server-generated IDs and timestamps.
- [ ] Return `201` and the created representation for valid input.
- [ ] Verify invalid input returns `400` without creating a record.

#### T-14 - Implement full and partial snippet updates

- [ ] Implement `PUT` replacement with all editable fields required.
- [ ] Implement `PATCH` for supplied fields only; `description: null` clears it.
- [ ] Validate before writing and return `404` for missing or non-owned IDs.
- [ ] Verify valid, invalid, partial, and cross-workspace updates.

#### T-15 - Implement snippet deletion

- [ ] Implement `DELETE /api/snippets/{snippetId}` for owned records.
- [ ] Return `204` with no body on success and `404` for missing or non-owned IDs.
- [ ] Verify deletion and workspace isolation.

#### T-16 - Implement snippet search and language filtering

- [ ] Search title and description with case-insensitive partial matching.
- [ ] Filter language with case-insensitive exact matching.
- [ ] Verify combined filters and workspace isolation.

#### T-17 - Implement sorting and pagination

- [ ] Support case-insensitive title/language sorting, ascending/descending order, and snippet-ID tie-breaking.
- [ ] Apply defaults: title ascending, limit 20, offset 0; enforce maximum limit 100.
- [ ] Return `total` after filters and before pagination; reject invalid query values with `400`.
- [ ] Verify defaults, mixed-case sort values, sort combinations, pagination, and totals.

## M3 - Workspace runner

#### T-18 - Restrict Worker network access through a request broker

- [ ] Serve the Worker with CSP `default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'` and verify supported browsers allow user JavaScript execution but block direct connections and nested workers.
- [ ] Provide a `fetch` interface that accepts a URL string and optional `method`, `headers`, and `body`; reject `Request` objects as unsupported.
- [ ] Validate URL origin, Snippets API route, method, and message shape in the broker; reject external URLs and app-support routes before network I/O.
- [ ] Keep the HttpOnly cookie value inaccessible to the Worker; use the browser session for allowed same-origin API requests.
- [ ] Reject pending and new broker requests when the run stops or times out.
- [ ] Verify allowed CRUD requests, external URL rejection, `/api/session` rejection, malformed messages, and stopped-run requests.

#### T-19 - Build the Workspace shell and navigation

- [ ] Add the dark application shell and Workspace, Examples, and My APIs navigation.
- [ ] Open directly to Workspace with no sign-in or welcome screen.
- [ ] Implement the initial editor/Results layout and usable narrow-screen layout.
- [ ] Verify keyboard navigation among primary views.

#### T-20 - Implement Workspace session loading states

- [ ] Show Workspace immediately with an editor-shaped skeleton while session data loads.
- [ ] Replace the skeleton with starter or saved code when loading succeeds.
- [ ] Keep Run disabled until source is ready.
- [ ] On failure, show Retry and do not substitute starter code.

#### T-21 - Implement the `api.js` editor

- [ ] Integrate CodeMirror 6 and show a single JavaScript file with syntax highlighting and line numbers.
- [ ] Keep the editor focused: no autocomplete, lint underlines, minimap, or file tabs.
- [ ] Preserve edited content, indentation, and line breaks.
- [ ] Verify keyboard editing and navigation.

#### T-22 - Implement editor autosave and recovery

- [ ] Save about one second after typing stops and survive reload.
- [ ] Show Saving and Saved states.
- [ ] On failure, keep edits and show Save failed with Retry.
- [ ] Prevent a stale or in-flight save from overwriting newer editor contents.
- [ ] Verify save/reload and simulated failure/retry.

#### T-23 - Implement Worker execution and console capture

- [ ] Complete T-18's network restrictions and broker verification before enabling user-code execution.
- [ ] Run current `api.js` in a dedicated browser Worker.
- [ ] Support ordinary JavaScript, Promises, and `async`/`await`.
- [ ] Support top-level `await` used by the starter `api.js` and bundled request examples.
- [ ] Support `fetch(url, { method, headers, body })` and responses exposing `status`, `ok`, `headers`, `json()`, and `text()`; verify `Request` objects are rejected as unsupported.
- [ ] Forward `console.log` output and runtime errors to Console.
- [ ] Verify user code has no DOM or shell access.

#### T-24 - Add Stop, timeout, and single-run behavior

- [ ] Allow only one active run; change Run to Stop while running.
- [ ] Terminate the Worker when the user selects Stop.
- [ ] End runs at 30 seconds and report the outcome clearly.
- [ ] Keep a run active while switching to Examples or My APIs; restore the Stop control on return to Workspace.
- [ ] Verify Stop, timeout, concurrent-run prevention, and navigation during a run.

#### T-25 - Capture Network request and response details

- [ ] Capture actual allowed API method, URL, request/response headers and bodies, status, and duration.
- [ ] Measure duration from request start through receipt of the full response body.
- [ ] Order Network entries by request start time, including concurrent requests whose responses complete out of order.
- [ ] Record HTTP error responses as network responses, separate from runtime errors.
- [ ] Verify requests made with the supported `fetch` URL/init fields and response properties, including HTTP error statuses.
- [ ] Reject disallowed network requests before they reach external services.
- [ ] Verify successful, invalid, and rejected requests, including concurrent requests with out-of-order responses.

#### T-26 - Build Console and Network result panels

- [ ] Add sibling Console and Network tabs; select Console initially.
- [ ] Show request list above Headers, Request, and Response details.
- [ ] Append results across runs; implement Clear for each panel and Copy for Console.
- [ ] Add the approved empty-state messages and keep results memory-only.
- [ ] Verify selection, details, append, clear, copy, retention while switching views, and clearing on page reload.

## M4 - Examples and My APIs

#### T-27 - Build the Examples view

- [ ] Bundle six JavaScript request examples with the frontend: list (`GET`), retrieve one (`GET`), create (`POST`), replace (`PUT`), partially update (`PATCH`), and delete (`DELETE`).
- [ ] List examples in any order with method labels, descriptions, and Load actions.
- [ ] Add a visible `snippetId` placeholder and an instruction to use an ID from My APIs in the retrieve, replace, partial update, and delete examples.
- [ ] Render the bundled list immediately without a server loading or unavailable state.
- [ ] Verify all six examples have their approved method label, description, and Load action.

#### T-28 - Implement example loading flow

- [ ] Load replaces `api.js`, saves it, and returns to Workspace.
- [ ] Supersede any pending save of older editor contents so the loaded example remains the latest saved source.
- [ ] Leave the example ready to review; do not run it automatically.
- [ ] On save failure, retain the example and offer Retry.
- [ ] Verify replacement, navigation, persistence, and failure recovery.

#### T-29 - Build the My APIs overview and snippet list

- [ ] Show the Snippets API description, overview, resource structure, endpoints, and records together.
- [ ] Handle loading, empty, and API failure states.
- [ ] Verify populated, empty, and failed responses.

#### T-30 - Add snippet list search, filters, sorting, and pagination

- [ ] Connect list controls to API search, language, sort, limit, and offset parameters.
- [ ] Reflect combined filter and sort results in the list.
- [ ] Handle empty results and API errors.
- [ ] Verify search, filtering, sorting, pagination, and combined controls.

#### T-31 - Add snippet detail side panel

- [ ] Open a selected record's full details, including code, in a side panel.
- [ ] Preserve code whitespace and line breaks.
- [ ] Return to the same list state when the panel closes.
- [ ] Verify details and list-state preservation.

#### T-32 - Implement snippet create and edit forms

- [ ] Add and edit records through side-panel forms using the Snippets API.
- [ ] Close the form and update the list after success.
- [ ] Keep form and values open on validation failure and show field errors.
- [ ] Verify successful saves and validation recovery.

#### T-33 - Implement confirmed snippet deletion

- [ ] Require confirmation before sending a delete request.
- [ ] Remove the record from the current view after success.
- [ ] Keep it visible and show an error if deletion fails.
- [ ] Verify cancel, success, and failure behavior.

#### T-34 - Add contextual HTTP and REST notes

- [ ] Show the notes drawer by default and allow collapse/reopen.
- [ ] Explain approved HTTP and REST concepts beside the user's work.
- [ ] Keep notes distinct from actual request and response data.
- [ ] Verify content and keyboard interaction.

## M5 - Integration and readiness

#### T-35 - Verify core user journeys end to end

- [ ] Add Playwright coverage for first visit, returning session, editing/running, examples, and snippet management.
- [ ] Cover critical failure and recovery paths.
- [ ] Verify workspace isolation across separate browser contexts.
- [ ] Run the configured Playwright suite.

#### T-36 - Review accessibility and responsive behavior

- [ ] Verify keyboard completion of primary journeys and visible focus indicators.
- [ ] Check accessible names and labels for controls and result regions.
- [ ] Verify Workspace and management views at narrow widths.
- [ ] Run configured accessibility checks, if available, and record manual review.

#### T-37 - Document local setup and verification

- [ ] Document prerequisites, environment configuration, database setup/migrations, and local commands in `README.md`.
- [ ] Document test, type-check, and build commands that exist in the project.
- [ ] Follow the instructions in a clean local setup; include no real secrets.

## Release checklist

- [ ] Must-have requirements are implemented and verified.
- [ ] Relevant automated tests pass.
- [ ] Linting, type checks, and production build pass where configured.
- [ ] Authorization, validation, and error handling have been reviewed.
- [ ] Relevant loading, empty, success, and error states are handled.
- [ ] Documentation and environment examples are up to date.
- [ ] Deployment, data migration, and rollback steps are understood where applicable.
