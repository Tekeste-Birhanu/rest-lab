# Application Flow

## 1. Navigation map

RestLab opens directly to Workspace. It has no sign-in or welcome screen.

```text
Application entry
  +-- Workspace (default)
  +-- Examples
  +-- My APIs
        +-- Snippets API overview and records
```

All views are available without an account. The browser's server-issued cookie identifies its private data. See `ARCHITECTURE.md` for identity enforcement and `API.md` for endpoint contracts.

## 2. Main journeys

### J-01 - Write and inspect an API request

- **Actor:** User and RestLab.
- **Entry point:** Application entry.
- **Steps:**
  1. RestLab displays Workspace immediately, with an editor-shaped skeleton while session data loads. Results opens on the empty Console tab.
  2. The interface initializes the browser session. On first use, RestLab creates the private workspace, seeds its sample snippets, and provides starter `api.js`. On return, it loads the saved `api.js`.
  3. When the source is ready, RestLab replaces the skeleton with the editor and enables Run.
  4. The user edits `api.js`. RestLab saves changes about one second after typing stops and shows Saving/Saved status.
  5. The user selects Run or presses Ctrl+Enter (Windows/Linux) or Cmd+Enter (macOS).
  6. RestLab runs the current editor contents in the browser Worker. Only one run is active at a time; while it runs, Run becomes Stop. Navigating to Examples or My APIs does not stop the run; on return to Workspace, Stop remains available if it is still running. A run stops when code finishes, the user selects Stop, or the 30-second limit is reached.
  7. Console output and HTTP requests/responses appear in their respective Results tabs. New entries append to previous runs until cleared.
- **Success outcome:** The user can inspect JavaScript output in Console and actual Snippets API activity in Network.
- **Failure and recovery:** If session initialization fails, replace the skeleton with an error and Retry action. Keep Run disabled and do not substitute starter code. JavaScript runtime errors appear in Console. HTTP errors appear as network responses with their status and body. Stop or timeout ends the active run; existing editor contents and earlier results remain available.
- **Related requirements:** F-01, F-02, F-03, F-04, F-10, F-11, F-12, F-14.

### J-02 - Learn from request behavior

- **Actor:** User.
- **Entry point:** Workspace while editing code or inspecting results.
- **Steps:**
  1. The user reads the visible notes drawer for a concise explanation related to HTTP or REST concepts.
  2. The user may collapse or reopen the drawer and continue working in the editor or Results.
- **Success outcome:** Notes explain concepts alongside the user's actual request and response without interrupting the workflow.
- **Related requirements:** F-05.

### J-03 - Use a request example

- **Actor:** User and RestLab.
- **Entry point:** Examples.
- **Steps:**
  1. The user chooses any listed example and selects Load.
  2. RestLab immediately replaces the current `api.js` with the example and saves it as the current source.
  3. RestLab returns to Workspace with the example ready to review or edit.
  4. The user selects Run when ready; loading never runs the example automatically.
- **Success outcome:** The example is in `api.js`, persisted, and ready for the user to inspect or run.
- **Failure and recovery:** If saving fails, retain the example in the editor and show Save failed with a Retry action. Do not run it automatically.
- **Related requirements:** F-01, F-06.

### J-04 - Explore and manage snippets

- **Actor:** User and RestLab.
- **Entry point:** My APIs.
- **Steps:**
  1. The user selects Snippets API to see its overview, resource structure, endpoints, and snippet records together.
  2. The user searches, filters, sorts, or pages through records, or opens a record's details in a side panel.
  3. To add or edit a record, the user completes the side-panel form and submits it. The interface uses the same Snippets API behavior as requests from `api.js`.
  4. To delete a record, the user confirms the destructive action.
- **Success outcome:** The record list and details reflect successful changes to the current browser's snippets.
- **Failure and recovery:** On validation errors, keep the form open with entered values and show field errors. On a failed save, keep the form data. If deletion fails, keep the record visible and show the error. Retry after correcting input or when the service is available.
- **Related requirements:** F-07, F-08, F-09, F-10, F-12.

## 3. Screen inventory

| View / state | Purpose | Access | Related journeys |
|---|---|---|---|
| Workspace | Edit and run `api.js`; inspect Console and Network. | Available on entry; no sign-in. | J-01, J-02 |
| Examples | Choose an optional JavaScript request example. | Main navigation. | J-03 |
| My APIs | Review the Snippets API and manage the current workspace's records. | Main navigation. | J-04 |
| Snippet side panel | View a snippet or create/edit its fields. | Opened from My APIs. | J-04 |

## 4. Shared states and recovery

- **Initial loading:** Show the Workspace shell immediately with an editor-shaped skeleton. Run remains disabled until source is loaded.
- **Session initialization failure:** Show a clear error and Retry action. Do not replace missing data with starter content until initialization succeeds.
- **Console and Network empty states:** Before the first run/output, Console says `Run api.js to see output.` Network says `Run api.js to see requests.` Console is selected by default.
- **Editor saving:** Show Saving while a save is in progress and Saved after success. If saving fails, keep the edited source and show Save failed with Retry.
- **API validation error:** Show the structured validation message. Do not clear editor contents or submitted form data.
- **Run error:** Keep JavaScript runtime errors in Console and HTTP outcomes in Network; do not conflate an HTTP error response with a JavaScript runtime error.
- **Snippet deletion:** Ask for confirmation before sending the delete request. On failure, leave the snippet visible.
- **Inactivity expiry:** A scheduled server-side cleanup runs daily, independently of user requests, and deletes workspaces and their snippets after at least 30 days without activity. On a later visit with no valid workspace, RestLab initializes a new workspace with sample snippets and starter `api.js`; the expired data cannot be recovered.
- **Browser data cleared:** A new browser session creates a new workspace. There is no account-based recovery or cross-device access.

## 5. Flow rules

- The app opens to Workspace and does not require sign-in.
- Run is unavailable until the initial `api.js` source has loaded.
- Run executes the current editor contents. Only one run executes at a time; Stop ends the active run. Navigation between app views does not stop a run; returning to Workspace restores access to Stop while it is active.
- Loading an example replaces `api.js`, saves it, and returns to Workspace without running it.
- Editor saves are automatic; Console and Network data remain in memory while switching between app views and are cleared on page reload.
- Console and Network results append across runs until the user clears them.
- GUI snippet operations and user-written requests use the same Snippets API validation and behavior.
- Workspace ownership is inferred from the server-issued cookie. User code can call only Snippets API routes; app-support session routes are not available to it.

## 6. Open flow questions

None from the current flow discussion.
