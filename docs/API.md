# API Contract

## 1. Scope and conventions

RestLab has one practice API: the Snippets API. User-written `api.js` requests may call only `/api/snippets` routes. The browser interface also uses the app-support routes below to initialize the anonymous browser session and save `api.js`; those routes are not available to user code.

The shared request examples are bundled with the frontend and copied into the workspace's saved `api.js` when selected. The catalog contains six examples: list snippets (`GET`), retrieve one snippet (`GET`), create (`POST`), replace (`PUT`), partially update (`PATCH`), and delete (`DELETE`). Users may load them in any order. The retrieve, replace, partial update, and delete examples use a visible `snippetId` placeholder and tell users to replace it with an ID from My APIs before running. They do not use an API endpoint or database table.

- **Base path:** `/api` on the RestLab application's origin.
- **Format:** JSON request and response bodies, except `204 No Content` responses and the `PUT /api/session/api-js` request, which is plain UTF-8 JavaScript source.
- **Request body limit:** JSON request bodies are limited to 2 MB. The `PUT /api/session/api-js` plain-text body is limited to 1 MB UTF-8.
- **Identity:** The server issues an HttpOnly, SameSite=Lax cookie that identifies the browser's workspace (also Secure in deployed HTTPS environments). The browser sends it automatically; requests must not send a workspace ID.
- **Mutation origin check:** Every `POST`, `PUT`, `PATCH`, and `DELETE` request must include an `Origin` header that exactly matches the configured RestLab application origin (scheme, host, and port). Reject missing or mismatched origins with `403 Forbidden` before performing a mutation. This applies to both Snippets API and app-support endpoints.
- **Content type:** Send `Content-Type: application/json` when a request has a JSON body. The editor save endpoint requires `text/plain; charset=utf-8`. Endpoints reject unsupported media types with `415`.
- **Unknown fields and query parameters:** Reject with `400 Bad Request` so mistakes are visible while learning.
- **Text:** Preserve snippet code exactly. Trim title and language before validation/storage. Description is optional and may be null.

## 2. Snippets API

These are the only endpoints callable from `api.js`.

| Method and path | Purpose | Success |
|---|---|---|
| `GET /api/snippets` | List the current workspace's snippets. | `200 OK` |
| `GET /api/snippets/{snippetId}` | Retrieve one snippet in the current workspace. | `200 OK` |
| `POST /api/snippets` | Create a snippet in the current workspace. | `201 Created` |
| `PUT /api/snippets/{snippetId}` | Replace all editable fields of a snippet. | `200 OK` |
| `PATCH /api/snippets/{snippetId}` | Update only the supplied editable fields. | `200 OK` |
| `DELETE /api/snippets/{snippetId}` | Delete a snippet in the current workspace. | `204 No Content` |

The server scopes every operation to the workspace identified by the cookie. A snippet belonging to another workspace is indistinguishable from a missing snippet and returns `404`.

### List query parameters

| Parameter | Meaning | Default / allowed values |
|---|---|---|
| `search` | Search snippet title and description. | Optional; case-insensitive substring match. |
| `language` | Filter by language. | Optional; case-insensitive exact match. |
| `sortBy` | Sort field. | `title` by default; `title` or `language`. |
| `order` | Sort direction. | `asc` by default; `asc` or `desc`. |
| `limit` | Maximum number of records returned. | `20` by default; maximum `100`. |
| `offset` | Number of matching records to skip. | `0` by default; non-negative safe integer. |

Sorting compares the selected field case-insensitively, with snippet ID as a stable tie-breaker for equal values. `total` is the count after applying search and language filters, before pagination.

Example: `GET /api/snippets?search=fetch&language=javascript&sortBy=title&order=asc&limit=20&offset=0`

### Snippet representation

```json
{
  "id": "2ef06592-b31d-4b72-a0ec-1cf273592e38",
  "title": "Fetch a JSON resource",
  "language": "JavaScript",
  "description": "A basic request using fetch.",
  "code": "const response = await fetch('/api/snippets');\nconsole.log(await response.json());",
  "createdAt": "2026-11-06T09:30:00Z",
  "updatedAt": "2026-11-06T09:30:00Z"
}
```

The example is fictional. `description` is `null` when no description is set. Timestamps are UTC ISO 8601 strings. Database fields use `snake_case`; API JSON uses `camelCase`.

### List response

```json
{
  "data": [
    {
      "id": "2ef06592-b31d-4b72-a0ec-1cf273592e38",
      "title": "Fetch a JSON resource",
      "language": "JavaScript",
      "description": "A basic request using fetch.",
      "code": "const response = await fetch('/api/snippets');\nconsole.log(await response.json());",
      "createdAt": "2026-11-06T09:30:00Z",
      "updatedAt": "2026-11-06T09:30:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1
  }
}
```

`GET /api/snippets/{snippetId}` and successful `POST`, `PUT`, and `PATCH` requests return one snippet representation directly as JSON.

### Create and update bodies

`POST /api/snippets` accepts:

```json
{
  "title": "Fetch a JSON resource",
  "language": "JavaScript",
  "description": "A basic request using fetch.",
  "code": "const response = await fetch('/api/snippets');\nconsole.log(await response.json());"
}
```

`title`, `language`, and `code` are required. `description` may be omitted or set to `null`.

`PUT /api/snippets/{snippetId}` requires all four editable fields (`title`, `language`, `description`, and `code`) and replaces the complete editable representation. `description` may be `null`.

`PATCH /api/snippets/{snippetId}` accepts one or more of those editable fields. Omitted fields remain unchanged; `description: null` clears the description. An empty patch is invalid. In both methods, all supplied fields are validated before any data is changed.

### Validation rules

- `title`: required for create and replace, trimmed, nonempty, maximum 120 characters.
- `language`: required for create and replace, trimmed, nonempty, maximum 50 characters. Preserve capitalization; language filtering is case-insensitive.
- `description`: optional or null, maximum 1,000 characters.
- `code`: required for create and replace, must contain non-whitespace content, maximum 100 KB UTF-8. Preserve the submitted code exactly.
- `snippetId`: UUID path parameter.
- `limit`: integer from 1 through 100; `offset`: non-negative safe integer, up to `9007199254740991` so it remains exact in JavaScript and JSON.
- `sortBy`: `title` or `language`; comparisons are case-insensitive. `order`: `asc` or `desc`.

Validation failures return `400` and do not modify stored data. Unsupported request content types return `415`. JSON request bodies above 2 MB return `413`; the plain-text `api.js` save body is limited to 1 MB UTF-8.

## 3. App-support endpoints

These endpoints are called by the RestLab interface, not by user-written `api.js`.

| Method and path | Purpose | Success |
|---|---|---|
| `POST /api/session` | Initialize the browser's anonymous session. Create a workspace with sample snippets and starter `api.js` if needed; otherwise return the existing workspace's saved editor source. | `201 Created` when created; `200 OK` when reused. |
| `PUT /api/session/api-js` | Save the current editor source for the cookie's workspace. | `200 OK` |

The session response sets or refreshes the HttpOnly, SameSite=Lax workspace cookie (also Secure in deployed HTTPS environments) and returns:

```json
{
  "apiJs": "const response = await fetch('/api/snippets');\nconsole.log(await response.json());"
}
```

The editor save body is the raw source text, sent with `Content-Type: text/plain; charset=utf-8`:

```javascript
const response = await fetch('/api/snippets');
console.log(await response.json());
```

The save response returns the saved source as `{ "apiJs": "..." }`. The editor source is limited to 1 MB in UTF-8. Requests exceeding this limit return `413 Payload Too Large`.

The browser calls `POST /api/session` on application startup, then saves changes with `PUT /api/session/api-js` about one second after typing stops. Cookie activity is refreshed on workspace reads and writes.

## 4. Errors

All error responses use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "title",
        "message": "Title is required."
      }
    ]
  }
}
```

`details` is optional and contains field-level validation problems when applicable. Error messages should help users understand the response without exposing stack traces, database details, cookie values, or other internal diagnostics.

| Status | When it is used |
|---|---|
| `400 Bad Request` | Invalid JSON, query/path parameter, unknown field, or validation failure. |
| `401 Unauthorized` | A workspace-data request requires a session, but its cookie is missing, malformed, or unknown. Initialize with `POST /api/session`. |
| `403 Forbidden` | A mutation request has a missing or mismatched `Origin` header. |
| `404 Not Found` | Snippet ID does not exist in the current workspace, or no API endpoint matches the requested path and method. |
| `413 Payload Too Large` | JSON request body exceeds 2 MB or the plain-text `api.js` source exceeds 1 MB UTF-8. |
| `415 Unsupported Media Type` | A JSON endpoint receives an unsupported content type. |
| `500 Internal Server Error` | Unexpected server failure; return a generic message. |

## 5. Activity, isolation, and runtime boundary

- Every workspace-data endpoint resolves the workspace from the server-issued cookie; clients never send a workspace ID. `POST /api/session` creates or resolves that session, and `/health` does not access workspace data.
- Any visit or action that reads or changes workspace data refreshes `last_activity_at`, matching the inactivity rule in the PRD. A scheduled server-side cleanup runs daily, independently of user requests, and deletes workspaces and their snippets when `last_activity_at` is at least 30 days old.
- Snippets API calls from the browser interface and from `api.js` use the same routes, validation, and persistence behavior.
- The same-origin `/restlab-worker.js` response uses CSP `default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'`. Its `fetch` function forwards requests to a browser-side broker over `postMessage`; the supported call form takes a URL string and an optional plain-object init with `method`, `headers` (a plain object of string values), and `body` (a string or null). `Request` objects are unsupported. The broker permits only same-origin `/api/snippets` routes with the methods documented in this contract. It rejects external URLs, `/api/session`, and all other paths before making a network request. The broker uses the browser's HttpOnly session cookie automatically; the cookie value is never available to user code. It resolves allowed calls to a Response-compatible object with `status`, `ok`, and `headers`, plus `json()` and `text()` methods. HTTP error statuses resolve as responses for inspection; they are distinct from rejected broker requests and JavaScript runtime errors. The Network panel shows request headers supplied through `fetch` and response headers exposed by the browser Fetch API; browser-managed request headers and Fetch-hidden response headers are not available to the app. Network duration measures from request start through receipt of the full response body. Requests made after a run has stopped or timed out are rejected.
- Console output and Network inspector data are returned to the browser UI for the current run and are not stored by these API endpoints.

