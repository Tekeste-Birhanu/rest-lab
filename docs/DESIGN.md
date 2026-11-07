# Design and UX Specification

## 1. Design direction

- **Product feel:** Simple, polished, professional, and welcoming to developers who are new to HTTP.
- **Primary audience:** Beginner and junior developers writing JavaScript API requests.
- **Design priorities:** Keep the code editor central, make real network activity easy to inspect, and explain concepts without interrupting the user's work.
- **Reference:** Take interaction cues from VS Code and the browser's Network panel. RestLab remains a focused workspace for its built-in Snippets API.
- **Theme:** Dark mode only. Use solid colors, with no gradients.

## 2. Design principles

- **Code is the main workspace:** Give `api.js` the most room and make Run easy to find.
- **Show what actually happened:** Distinguish actual requests, responses, and JavaScript output from explanatory notes.
- **Explain in context:** Keep concise HTTP and REST notes available beside the code and results.
- **Make data readable:** Display full snippet code and structured request or response data with useful formatting.
- **Keep navigation simple:** Provide Workspace, Examples, and My APIs as the main views; users can explore examples in any order.

## 3. Visual foundations

- **Typography:** Use a readable interface font for labels and explanations, and a legible monospace font for code, URLs, headers, and JSON.
- **Color:** Use a dark neutral palette, clear panel boundaries, and a restrained solid blue accent. Use semantic status colors and pair them with text or icons; avoid gradients. Define exact color tokens during implementation.
- **Spacing:** Use consistent spacing between the editor, notes, inspector panels, and API content.
- **Shape and elevation:** Prefer clear panel boundaries and restrained borders. Avoid decorative shadows that compete with code.
- **Icons and imagery:** Use simple, familiar interface icons where they help recognition. Avoid decorative imagery in the workspace.
- **Code presentation:** Use JavaScript syntax highlighting and line numbers in the `api.js` editor. Preserve code whitespace, indentation, and line breaks.
- **Responsive behavior:** On wide screens, place the editor and Results side by side. On narrow screens, stack them and keep Run, Results, notes, and navigation usable.
- **Motion:** Avoid unnecessary animation and respect reduced-motion preferences.

## 4. Components and patterns

| Component / pattern | Purpose | Relevant behavior / variants |
| --- | --- | --- |
| Main navigation | Move between core views | Provides Workspace, Examples, and My APIs. The app opens to Workspace. |
| JavaScript editor | Write the request code | Shows one file, `api.js`, prefilled with a sample GET request for retrieving snippets. Uses CodeMirror 6 for a VS Code-inspired editing surface with syntax highlighting and line numbers; no autocomplete, error underlines, minimap, or file tabs. |
| Run control | Execute `api.js` | Visible and easy to find. Ctrl+Enter runs on Windows/Linux; Cmd+Enter runs on macOS. |
| Workspace layout | Give code and results room | Editor and Results start at a 60/40 split. A draggable divider resizes them; Results can collapse. Remember panel sizes and the selected Results tab in the browser. |
| Context notes | Explain HTTP and REST concepts alongside work | A collapsible drawer, visible by default, with concise plain-language notes related to the user's work. |
| Results tabs | Inspect execution output and requests | Console and Network are sibling tabs. Console is selected on first open. Results from subsequent runs append until cleared. |
| Network inspector | Inspect API calls made by a run | Includes a request list ordered by request start time and a detail pane below it. Selecting a request reveals details in Headers, Request, and Response tabs; Headers is selected by default. |
| Console output | Show JavaScript output and runtime errors | Compact terminal-style panel for `console.log` output and runtime errors. Provides Copy and Clear controls. |
| Examples | Browse JavaScript request examples | Shows six bundled examples with a short description, HTTP method label, and Load action: list (`GET`), retrieve (`GET`), create (`POST`), replace (`PUT`), partially update (`PATCH`), and delete (`DELETE`). Single-record examples explain how to replace the visible `snippetId` placeholder with an ID from My APIs. Loading replaces the current `api.js` contents immediately and does not run the code. |
| My APIs | Interact with the built-in Snippets API | Lists Snippets API with a short description. Selecting it opens its overview, resource structure, endpoints, and snippet management in one view. Users can create, edit, and delete snippet records through the UI. |
| Snippet detail and forms | Inspect and manage one snippet | Selecting a record opens its full details in a side panel. Add/edit forms use a side panel; deletion asks for confirmation. Preserve code formatting. |

## 5. Screen-specific guidance

### Workspace

- **Purpose:** Write and run JavaScript requests against the built-in Snippets API and understand the resulting behavior.
- **Initial state:** Open the app to Workspace. `api.js` contains a sample GET request to retrieve snippets. The Results area opens on Console.
- **Layout and hierarchy:** Keep the editor as the primary region, initially 60% of the editor/Results width. Put Results beside it, with a resizable divider and a control to collapse Results. Stack the regions on narrow screens.
- **Editor:** Show only `api.js`, with JavaScript syntax highlighting and line numbers. Keep editing focused and simple, without autocomplete or error underlines. Provide a clear Run action and support Ctrl+Enter / Cmd+Enter.
- **Results:** Console and Network are sibling tabs. New output and requests append across runs; each tab has a Clear action. Console also has a Copy action. Remember the selected Results tab and panel sizing in the browser.
- **Network details:** Keep the request list above the selected request details, ordered by request start time so concurrent requests stay in initiation order even if responses complete out of order. Show duration through receipt of the full response body. Follow the browser Network panel pattern. Detail tabs are Headers, Request, and Response, with Headers selected by default.
- **Empty states:** Before any output, Console says “Run `api.js` to see output.” Before any requests, Network says “Run `api.js` to see requests.”
- **Related flow:** J-01 and J-02 in `APP_FLOW.md`.

### Context notes

- **Purpose:** Explain HTTP and REST concepts while users write or inspect requests.
- **Layout:** Use a collapsible drawer visible by default, so notes remain accessible without displacing the editor and Results.
- **Content:** Use brief explanations connected to the current request, response, method, status, or validation outcome.
- **Related flow:** J-02 in `APP_FLOW.md`.

### Examples

- **Purpose:** Help users inspect and load JavaScript request examples.
- **Layout:** Render the six examples bundled with the frontend immediately in a simple list. Each item shows its HTTP method, a short description, and a Load action. Descriptions for single-record examples tell users to replace the visible `snippetId` placeholder with an ID from My APIs before running.
- **Behavior:** Loading immediately replaces the contents of `api.js`; it does not execute the example. Users can choose examples in any order.
- **Related flow:** J-03 in `APP_FLOW.md`.

### My APIs and Snippets API

- **Purpose:** Let users understand the sample API and manage snippets through a GUI.
- **Layout and hierarchy:** My APIs lists the Snippets API with a short description. Selecting it shows a general API overview, resource structure, endpoints, and snippet records together.
- **Snippet interactions:** Users can add, edit, and delete records. Selecting a record opens a side-panel detail view with the full code. Add/edit forms use side panels; deleting a record requires confirmation.
- **Related flow:** J-04 in `APP_FLOW.md`.

## 6. Interaction and UI states

- **Interactive states:** Provide clear hover, focus, selected, pressed, and disabled states for navigation, editor actions, examples, tabs, and request rows.
- **Execution feedback:** Show when code is running and when it completes. Keep Console and Network output associated with each run while appending new results.
- **Validation and errors:** Present JavaScript runtime errors in Console and HTTP outcomes in Network. Keep the user's editor content intact when a request fails.
- **Empty states:** Use the Console and Network hints defined above. Provide useful loading, empty, and error states for My APIs. Examples are bundled with the frontend and render immediately.
- **Saving:** Indicate whether `api.js` changes are saved to the browser workspace.
- **Destructive actions:** Ask for confirmation before deleting a snippet.
- **Example loading:** Loading an example replaces the editor contents immediately, without a confirmation prompt, and never runs it automatically.

## 7. Accessibility

- Use semantic structure and meaningful labels for the editor, Run control, navigation, Results tabs, Network inspector, Console, notes, and API management controls.
- Ensure keyboard access and visible focus, including running code with Ctrl+Enter / Cmd+Enter, navigating request rows, and using examples.
- Maintain readable contrast and do not rely on color alone for request or error status.
- Give code panels and result regions accessible names and preserve logical reading order, especially when panels stack on small screens.
- Respect reduced-motion preferences.

## 8. Content guidelines

- **Tone and terminology:** Clear, calm, and respectful of beginners. Explain technical terms briefly when they first matter.
- **Labels and messages:** Use consistent terms such as `api.js`, Workspace, Examples, My APIs, Snippets API, Network, Console, Headers, Request, and Response.
- **Explanations:** Explain the concept behind a request or response without altering or misrepresenting actual network data.
- **Errors:** State what failed and what the user can try next. Keep JavaScript errors separate from HTTP status outcomes.

## 9. Open design questions

None. Exact color tokens and responsive breakpoints can be selected during implementation while following the visual and layout guidance above.
