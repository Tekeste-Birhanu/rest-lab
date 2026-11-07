# Product Requirements Document

## 1. Overview

- **Product:** RestLab
- **Summary:** A hands-on JavaScript API workspace for learning HTTP and REST. Users write and run JavaScript requests against RestLab's built-in Snippets API, inspect request and response details, and read clear explanations alongside their work.
- **Target users:** Beginner and junior developers learning HTTP, REST APIs, and JavaScript API requests.
- **Problem:** Learners need a practical way to understand how HTTP requests work, how methods affect data, and how responses communicate outcomes before designing APIs themselves. RestLab provides one API to work with and a workspace for writing real JavaScript request code.

## 2. Goals and scope

### Goals

- Help users understand the core HTTP request/response model and REST concepts, including resources, URLs, representations, and stateless requests.
- Let users write and run JavaScript using `fetch`, Promises, `async`/`await`, loops, conditionals, and other standard JavaScript constructs.
- Help users see how HTTP methods affect stored snippets and how status codes and validation errors describe outcomes.
- Make actual request and response behavior understandable through an in-app Network inspector and contextual notes.
- Let users manage snippets through both JavaScript requests and the My APIs interface.

### In scope for V1

- Three main views: Workspace, Examples, and My APIs. The app opens to Workspace.
- A single JavaScript editor file named `api.js`, prefilled with a sample GET request that retrieves snippets and automatically saved to the user's browser workspace.
- Running JavaScript request code against the built-in Snippets API only. The editor supports one file; code has no DOM or shell access.
- Results with sibling Console and Network tabs. Console is selected initially. New output and requests append across runs until cleared.
- A Network inspector that lists actual API calls and shows request details in Headers, Request, and Response tabs. Selecting a request displays its details below the request list; Headers is selected by default.
- A Console panel for `console.log` output and JavaScript runtime errors, with Copy and Clear controls. The Network panel also has a Clear control.
- Contextual, plain-language notes about HTTP and REST concepts while users write and inspect requests. Notes appear in a collapsible drawer, visible by default. RestLab is a hands-on workspace, not a sequenced tutorial course.
- An Examples view with optional JavaScript request examples. Examples can be used in any order, are labeled by HTTP method, and include a short description. Loading an example immediately replaces the contents of `api.js`; it does not run automatically.
- A My APIs view listing the built-in Snippets API with a short description. Selecting it shows the API overview, resource structure, endpoints, and snippet records in one view.
- Snippet record management through the My APIs view: users can create, edit, and delete records. Selecting a record opens its full details, including code, in a side panel. Add and edit forms use side panels; deletion requires confirmation.
- Search, language filtering, sorting, and pagination for the snippet collection.
- A separate browser workspace for each user, without accounts or cross-device access. Each new workspace starts with its own sample snippets. Inactive workspaces are deleted after 30 days.
- A deployable application with persistent workspace data.

### Out of scope for V1

- Sending requests to arbitrary external APIs or user-configured APIs. User-written requests target the built-in Snippets API.
- Designing additional APIs inside RestLab; Snippets API is the single practice API.
- Multiple editor files, shell commands, or DOM access from `api.js`.
- Persistent request history and cross-device workspace access.
- AI-generated explanations.

### Constraints

- Prefer free and open-source tools and services. Identify deployment costs and free-tier limits before choosing providers.
- The product must support local development and a deployed application.

## 3. User journeys

- **J-01 - Write and inspect an API request:** The user opens Workspace, reviews or edits the sample code in `api.js`, runs it against the Snippets API, and inspects the resulting network activity and code output.
- **J-02 - Learn from request behavior:** While writing code or inspecting a result, the user reads contextual notes explaining relevant HTTP or REST concepts, methods, status codes, or validation outcomes.
- **J-03 - Use an example request:** The user opens Examples, chooses an example, loads it into `api.js` (replacing its current contents), reviews or edits it, and runs it when ready.
- **J-04 - Explore and manage snippets:** The user opens My APIs, selects Snippets API, reviews its overview, structure, and endpoints, then browses, creates, edits, or deletes snippet records through the interface.

## 4. Functional requirements

| ID   | Requirement                                   | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Priority |
| ---- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F-01 | Provide a JavaScript request workspace        | The app opens to Workspace. It contains one file named `api.js` prefilled with a sample GET request to retrieve snippets; edits are automatically saved for that browser workspace. The editor shows JavaScript syntax highlighting and line numbers.                                                                                                                                                                                                                                                                 | Must     |
| F-02 | Run JavaScript request code                   | Users can run code containing ordinary JavaScript control flow, functions, Promises, and `async`/`await`. The supported `fetch` form takes a URL string and optional `method`, `headers`, and `body`; `Request` objects are unsupported. Its response provides `status`, `ok`, `headers`, `json()`, and `text()`. The code can call only the built-in Snippets API and cannot access the application DOM or shell commands. Navigating to another app view does not stop an active run; users can return to Workspace to stop it. Ctrl+Enter runs on Windows/Linux and Cmd+Enter runs on macOS. | Must     |
| F-03 | Inspect network activity                      | Each API call made by a run appears in the Network tab, ordered by request start time even when responses complete in a different order. Selecting a call shows method, URL, request headers and body, response status, response headers and body, and duration from request start through receipt of the full response body. The request list appears above the details, with Headers, Request, and Response tabs; Headers is selected by default. New calls append across runs until cleared. Results remain available when switching between app views and clear on page reload. | Must     |
| F-04 | Inspect code output                           | The Console tab shows `console.log` output and JavaScript runtime errors. It is separate from HTTP response details. New output appends across runs until cleared. Results remain available when switching between app views and clear on page reload. Console provides Copy and Clear controls; Network provides a Clear control.                                                                                                                                                                                                                                      | Must     |
| F-05 | Learn HTTP and REST in context                | A collapsible notes drawer, visible by default, explains the request/response model, methods, URLs, headers, bodies, status codes, validation errors, resources, representations, and stateless requests when relevant to the user's work.                                                                                                                                                                                                                                                                            | Must     |
| F-06 | Browse request examples                       | Examples lists six bundled JavaScript requests: list snippets (`GET`), retrieve one snippet (`GET`), create (`POST`), replace (`PUT`), partially update (`PATCH`), and delete (`DELETE`). Each has a short description and HTTP method label. Single-record examples show a `snippetId` placeholder and explain that users should replace it with an ID from My APIs before running. Users may choose examples in any order. Loading replaces current `api.js` contents immediately and does not execute the example. | Must     |
| F-07 | Manage snippets through the API and interface | The built-in API supports listing, retrieving, creating, replacing, partially updating, and deleting snippets. My APIs presents the Snippets API overview, resource structure, endpoints, and snippet records together. Users can create, edit, and delete records in the interface. Successful changes affect only the user's workspace.                                                                                                                                                                             | Must     |
| F-08 | Filter and navigate the snippet collection    | Users can search by a case-insensitive partial match on title and description, filter by language without case sensitivity, sort by title or language case-insensitively in ascending or descending order, and paginate results. Equal sort values use snippet ID as a stable tie-breaker. Default sort is title ascending; pagination uses `limit` and `offset`, with a default limit of 20 and maximum of 100.                                                                                                        | Must     |
| F-09 | Inspect snippet records                       | Selecting a record in My APIs opens a side panel with its details and full code. Add and edit forms appear in side panels; deleting a record requires confirmation. Code whitespace and line breaks are preserved.                                                                                                                                                                                                                                                                                                    | Must     |
| F-10 | Isolate user workspaces                       | Each browser receives a separate workspace without requiring an account. A workspace starts with its own copies of three sample snippets (JavaScript, Python, and SQL) and its saved `api.js`; users cannot view or change another workspace's data.                                                                                                                                                                                                                                                                  | Must     |
| F-11 | Expire inactive workspaces                    | A scheduled server-side cleanup runs daily and deletes each workspace and its snippets once `last_activity_at` is at least 30 days old. It runs independently of user requests. Any visit or action that reads or changes workspace data resets the inactivity timer.                                                                                                                                                                                                                                                 | Must     |
| F-12 | Handle API errors clearly                     | Invalid requests return structured errors that explain the problem without exposing stack traces or internal diagnostics. Failed validation does not modify stored snippets.                                                                                                                                                                                                                                                                                                                                          | Must     |
| F-13 | Adjust the Workspace layout                   | The editor and Results start at a 60/40 split. Users can resize the divider or collapse Results. The browser remembers panel sizes.                                                                                                                                                                                                                                                                                                                                                                                   | Must     |
| F-14 | Remember the Results view                     | Console is selected when the Workspace is first opened. Console and Network are sibling tabs. The selected tab is remembered in the browser after the user changes it.                                                                                                                                                                                                                                                                                                                                                | Must     |

### Snippet data rules

- A snippet has an ID, title, language, code, and optional description.
- Title and language are required, trimmed, and nonempty. Title is limited to 120 characters; language is limited to 50 characters. Language values are flexible and retain their submitted capitalization; filtering is case-insensitive.
- Code is required, must contain non-whitespace content, and is limited to 100 KB in UTF-8. The API preserves code exactly, including indentation and blank lines.
- The saved `api.js` source is limited to 1 MB in UTF-8.
- Description is optional and limited to 1,000 characters.
- Tags are not part of V1.
- Snippet code can be written in any programming language. JavaScript is the language used in `api.js` to make API requests.

### HTTP behavior

- The API demonstrates `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` behavior.
- Successful creation returns `201 Created`; successful deletion returns `204 No Content`; successful reads and updates return `200 OK`.
- Invalid input returns `400 Bad Request`; a valid ID with no matching snippet or an unknown API path/method returns `404 Not Found`.
- Unsupported media types for JSON request bodies return `415 Unsupported Media Type`.
- Validation failures do not modify data.

## 5. Quality requirements

- **Security and privacy:** User workspaces must be isolated server-side. All API mutation requests must pass a server-side `Origin` check against the configured application origin; `SameSite=Lax` is defense in depth. JavaScript execution must not expose the application DOM, shell access, or another user's workspace. Request code is limited to the built-in Snippets API.
- **Reliability:** API failures and JavaScript runtime errors appear in the appropriate result panel. A failed request does not erase editor content. New Console and Network results append until cleared, survive switching between app views, and clear on page reload.
- **Accessibility:** The editor, navigation, Results tabs, request details, notes, and snippet management controls must be keyboard accessible, labeled, and usable with assistive technology. Focus indicators and readable contrast are required.
- **Visual design:** Use dark mode only, with a restrained solid blue accent and no gradients. Do not rely on color alone to communicate status.
- **Cost:** The project should be usable and deployable with free/open-source tooling where feasible. Provider-specific free-tier limits and recurring costs must be documented before deployment.

## 6. Assumptions and open decisions

- **Assumption:** A browser workspace is identified by that browser on one device. Clearing browser site data may make its workspace inaccessible; cross-device recovery is not in V1.
- **Dependencies / risks:** Free database and hosting tiers may impose usage, storage, uptime, or persistence limits. Choose deployment services with these limits documented.

## 7. Readiness

### Product requirements ready for implementation

- [x] The product goal, target users, and MVP scope are defined.
- [x] The main user journeys and workspace behavior are defined.
- [x] The core API resource and HTTP learning outcomes are defined.
- [x] Snippet field length limits are approved: title 120 characters, language 50 characters, description 1,000 characters, and code 100 KB UTF-8.
- [x] Workspace activity is defined: any visit or action that reads or changes workspace data resets the 30-day inactivity timer.
- [x] The JavaScript runner's security and execution limits are defined in the architecture; T-18 still requires implementation verification before runtime work is complete.
- [x] The Examples loading behavior is defined: loading immediately replaces `api.js` contents and does not run the example.

### Deployment readiness (pending)

- [ ] Review hosting and database free-tier limits before selecting a deployment provider.
