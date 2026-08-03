# Technical Requirements — AI DIAL Chat Next Generation

> Related: [Epic #6799](https://github.com/epam/ai-dial-chat/issues/6799) · [Architecture](./architecture.md)

---

## Scope

This document defines functional and non-functional requirements for the initial release of AI DIAL Chat Next Generation. Requirements are derived from the architecture decisions and the current implementation gap analysis.

**Already implemented (out of scope here):** OIDC auth flow, session/CSRF, SSE streaming, theming (ThemeProvider + CSS vars), i18n scaffold (EN + AR), RTL direction switching, conversation CRUD backend endpoints, models/deployments API.

---

## Functional Requirements

### FR-1 — Conversation Input (`@epam/ai-dial-conversation-input`)

| ID     | Requirement                                                                                                                    | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-1.1 | User can type a message and send it via the Send button or `Enter` key                                                         | Must     |
| FR-1.2 | `Shift+Enter` inserts a newline without sending                                                                                | Must     |
| FR-1.3 | Send button is disabled when the input is empty or a response is streaming                                                     | Must     |
| FR-1.4 | User can attach files to a message; attached files are displayed as chips before sending                                       | Should   |
| FR-1.5 | User can remove an attached file chip before sending                                                                           | Should   |
| FR-1.6 | Input supports slash commands (e.g. `/help`) with a dropdown picker                                                            | Could    |
| FR-1.7 | Input supports `@mention` syntax with a dropdown picker                                                                        | Could    |
| FR-1.8 | Conversation Input shows the selected deployment's finite or unlimited monthly token allowance through a compact usage control | Should   |
| FR-1.9 | Finite limits reveal a percentage; unlimited limits reveal `Unlimited`; both open a one-bar `Usage Limit` popover              | Should   |

#### Token-usage limits control

The app-owned `UsageLimitsControl` is passed to the isolated Conversation Input
library through `usageLimitsSlot`. It reads only `monthTokenStats`. At rest the
trigger shows a compact circular ring; hover, keyboard focus, and the open state
reveal either the finite percentage or the localized `Unlimited` value at the
ring's inline-start side inside one rounded capsule.

For finite limits the popover shows one monthly `DialProgressBar` and
`N tokens remaining`. For unlimited limits it follows the Catalog convention:
the row remains visible, the progress bar uses the normalized `used` and raw
`total`, and the value is `Unlimited`. Opening the popover refreshes data
silently without replacing its content with a loader. At 90% finite usage the
ring and percentage use the theme error color.

### FR-2 — Message Feed (`@epam/ai-dial-conversation-messages`)

| ID      | Requirement                                                                           | Priority |
| ------- | ------------------------------------------------------------------------------------- | -------- |
| FR-2.1  | User messages and assistant messages are visually distinct                            | Must     |
| FR-2.2  | Assistant message text is rendered as Markdown (headings, lists, bold, italic, links) | Must     |
| FR-2.3  | Code blocks in assistant messages are rendered with syntax highlighting               | Must     |
| FR-2.4  | Streaming assistant messages render incrementally as chunks arrive                    | Must     |
| FR-2.5  | A typing/loading indicator is shown while the first chunk has not yet arrived         | Must     |
| FR-2.6  | User can copy an assistant message to clipboard                                       | Must     |
| FR-2.7  | User can regenerate (retry) the last assistant message                                | Must     |
| FR-2.8  | User can edit a sent message; editing triggers a new completion from that point       | Should   |
| FR-2.9  | File/image attachments in messages are rendered as chips or inline previews           | Should   |
| FR-2.10 | Message actions (copy, regenerate, edit) are visible on hover                         | Must     |

### FR-3 — Conversation View (`apps/chat`)

| ID     | Requirement                                                                                                            | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-3.1 | Sending a message from the home screen creates a new conversation and navigates to it                                  | Must     |
| FR-3.2 | The conversation view displays the full message history loaded from the backend                                        | Must     |
| FR-3.3 | The view scrolls to the bottom automatically while streaming; user can scroll up mid-stream without being snapped back | Must     |
| FR-3.4 | User can abort an in-progress streaming response                                                                       | Must     |
| FR-3.5 | An error message is shown if the stream fails                                                                          | Must     |

### FR-4 — Conversation List

| ID     | Requirement                                                            | Priority |
| ------ | ---------------------------------------------------------------------- | -------- |
| FR-4.1 | A sidebar lists the user's past conversations, most recent first       | Must     |
| FR-4.2 | Clicking a conversation in the sidebar navigates to it                 | Must     |
| FR-4.3 | The list updates immediately when a new conversation is created        | Must     |
| FR-4.4 | User can delete a conversation from the sidebar                        | Should   |
| FR-4.5 | Conversation items display a title derived from the first user message | Should   |

### FR-5 — Model Selector

| ID     | Requirement                                                                                       | Priority |
| ------ | ------------------------------------------------------------------------------------------------- | -------- |
| FR-5.1 | User can select which model/deployment to use before or during a conversation                     | Must     |
| FR-5.2 | Available models are loaded from `GET /api/v1/models`                                             | Must     |
| FR-5.3 | The selected model persists for the session                                                       | Must     |
| FR-5.4 | If the previously selected model is no longer available, the user is prompted to select a new one | Should   |

### FR-6 — Authentication

| ID     | Requirement                                                                                             | Priority |
| ------ | ------------------------------------------------------------------------------------------------------- | -------- |
| FR-6.1 | Unauthenticated users are redirected to the login page                                                  | Must     |
| FR-6.2 | Login page lists all configured OIDC providers                                                          | Must     |
| FR-6.3 | After successful login, user is redirected to the page they originally requested                        | Must     |
| FR-6.4 | User can sign out; session cookie is cleared and IdP end_session_endpoint is called                     | Must     |
| FR-6.5 | Access tokens are refreshed silently before expiry; the user is never asked to log in again mid-session | Must     |

### FR-8 — Internationalisation and RTL

| ID     | Requirement                                                                                                                                                                                                           | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-8.1 | App ships with full Arabic (`ar`) translation coverage matching all keys in `en.json`                                                                                                                                 | Must     |
| FR-8.2 | Active locale is detected from browser settings and persisted in `localStorage`; a language-selector UI allows manual override                                                                                        | Must     |
| FR-8.3 | When an RTL locale is active, `<html dir="rtl">` and the matching `lang` attribute are set before first render; switching locale updates them                                                                         | Must     |
| FR-8.4 | All layout components use CSS logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `border-s-*`, `border-e-*`); no component relies on physical `left`/`right` utilities for directional behaviour | Must     |
| FR-8.5 | Directional icons (back/forward chevrons, navigation arrows, collapse indicators) are mirrored in RTL via `rtl:scale-x-[-1]` or equivalent                                                                            | Must     |
| FR-8.6 | Mobile slide-in panels (navigation drawer, conversation panel) enter and exit from the start edge in both LTR and RTL                                                                                                 | Must     |
| FR-8.7 | Adding a new locale requires only: a translation JSON file, one line in `i18n/config.ts`, and — if RTL — one entry in `RTL_LANGUAGES`                                                                                 | Should   |

### FR-7 — Theming

| ID     | Requirement                                                                     | Priority |
| ------ | ------------------------------------------------------------------------------- | -------- |
| FR-7.1 | The active theme is loaded from `GET /api/themes` at app startup                | Must     |
| FR-7.2 | Theme tokens are injected as CSS custom properties on `:root`                   | Must     |
| FR-7.3 | All UI components respect the active theme colours with no hardcoded hex values | Must     |
| FR-7.4 | Theme selection persists across page reloads (localStorage)                     | Must     |
| FR-7.5 | The app logo and favicon are sourced from the active theme config               | Must     |

---

## Non-Functional Requirements

### NFR-1 — Performance

| ID      | Requirement                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------- |
| NFR-1.1 | First Contentful Paint < 2 s on a 10 Mbps connection                                                  |
| NFR-1.2 | Streaming first-token latency adds no more than 100 ms on top of DIAL Core response time              |
| NFR-1.3 | Model list is cached server-side for 30 s per user; repeated requests within TTL do not hit DIAL Core |
| NFR-1.4 | Route components are lazy-loaded; no route's JS chunk exceeds 200 kB gzipped                          |

### NFR-2 — Security

| ID      | Requirement                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-2.1 | All state-changing API calls include a `X-CSRF-Token` header validated against the session                                                                     |
| NFR-2.2 | Session cookies are `HttpOnly`, `Secure` by default, `SameSite=Lax` normally, and `SameSite=None; Secure` only for overlay embedding that must work cross-site |
| NFR-2.3 | `helmet` enforces CSP, HSTS, and standard security headers on all responses                                                                                    |
| NFR-2.4 | No auth tokens or user credentials are ever passed to or stored by UI libraries                                                                                |
| NFR-2.5 | Conversation completions endpoint is rate-limited to 10 req/min per session                                                                                    |

### NFR-3 — Accessibility

| ID      | Requirement                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-3.1 | Message feed has `role="log"` and `aria-live="polite"`                                                                                         |
| NFR-3.2 | Error messages use `role="alert"`                                                                                                              |
| NFR-3.3 | All interactive controls are keyboard-navigable (Tab, Enter, Escape)                                                                           |
| NFR-3.4 | Send button has a descriptive `aria-label`                                                                                                     |
| NFR-3.5 | All `aria-label` values are translated strings — no hardcoded English in aria attributes; libs expose label props, the app passes `t()` values |

### NFR-4 — Reliability

| ID      | Requirement                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------- |
| NFR-4.1 | SSE stream errors surface a user-visible message and allow the user to retry                   |
| NFR-4.2 | If the token refresh fails, the user is redirected to login rather than receiving a silent 401 |
| NFR-4.3 | Backend returns structured error responses (status code + message) for all 4xx/5xx cases       |

### NFR-5 — Testability

| ID      | Requirement                                                                         |
| ------- | ----------------------------------------------------------------------------------- |
| NFR-5.1 | Every new React hook and utility function has unit tests (Vitest + Testing Library) |
| NFR-5.2 | Every new NestJS controller has integration tests (supertest)                       |
| NFR-5.3 | Tests use role/label/text queries instead of implementation-specific selectors      |
| NFR-5.4 | Tests describe observable behaviour, not implementation details                     |

### NFR-6 — Code Quality

| ID      | Requirement                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------- |
| NFR-6.1 | TypeScript strict mode — no `any`, no `@ts-ignore` without justification                                               |
| NFR-6.2 | All exported symbols in `libs/*` have JSDoc comments                                                                   |
| NFR-6.3 | No direct `fetch` calls in components or hooks — use typed helpers from `server-api/base.ts`                           |
| NFR-6.4 | All user-visible strings go through `useTranslation()` — no hardcoded UI text                                          |
| NFR-6.5 | Module boundary rules enforced: `apps/*` may not import from each other; `type:ui` libs import only from `chat-shared` |

---

## Open Questions

### OQ-1 — State management

**Owner:** Arch · **Needed before:** FR-4 (conversation list)

Currently `apps/chat` uses React Context for auth (`UserContext`) and theming (`ThemeContext`). This is sufficient for the current two-screen scope.

**Problem:** Adding a conversation list (FR-4) and a model selector (FR-5) introduces shared mutable state that multiple components need to read and write — conversation list, selected model, active conversation ID, streaming status. Scaling this with more contexts risks deep provider trees and uncontrolled re-renders.

**Options:**

| Option                 | Trade-offs                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Keep React Context** | Simple, no new deps. Works if state slices stay isolated. Risk: performance problems if a single context holds too much (e.g. conversation list + streaming state in one provider causes full-tree re-renders on every chunk). |
| **Zustand**            | Minimal boilerplate, no provider wrapping needed, fine-grained subscriptions. Well-suited for this app size. Adds one dependency.                                                                                              |
| **Redux Toolkit**      | Battle-tested for large apps, excellent devtools, but significant boilerplate overhead for this scope.                                                                                                                         |
| **Jotai**              | Atomic model — each piece of state is independent, minimises re-renders. Closest to Context mental model. Less mature ecosystem.                                                                                               |

**Recommendation to decide:** Choose between React Context (split into more fine-grained providers) and Zustand before starting FR-4. The streaming state (updating one message on every SSE chunk) is the hardest case — whichever option handles that without re-rendering the full list is the right choice.

---

### OQ-2 — Attachment support

**Owner:** Backend · **Needed before:** FR-1.4 (attachment picker)

The architecture lists attachments as a responsibility of `@epam/ai-dial-conversation-input` and the message feed. The following is unknown without inspecting DIAL Core docs or running tests:

- **Accepted MIME types** — images only, or arbitrary files (PDF, code, CSV)?
- **Size limit** — per file and per request
- **Transfer encoding** — does `POST /conversations/completions` accept multipart, base64-encoded, or a reference URL?
- **Upload flow** — does the frontend upload files directly to DIAL Core storage, or does `apps/chat-api` proxy the upload?
- **Rendering** — does DIAL Core return attachment metadata in message responses, and if so, what shape?

Until these are answered, FR-1.4 and FR-2.9 cannot be specced in detail. They are marked **Should** and unblocked from the frontend only after the upload contract is defined.

---

### OQ-3 — Conversation title

**Owner:** Backend · **Needed before:** FR-4.5 (conversation list items)

A conversation list entry needs a human-readable title. Three options:

| Option                                               | Trade-offs                                                                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Client-side: first user message, truncated**       | Zero backend work. Title is always available instantly. Breaks if the first message is short/generic ("Hi") or if the conversation is loaded without the full history. |
| **Backend field: `title` in `ConversationMetadata`** | Clean contract, works even when loading metadata-only list. Requires backend to derive/store the title on create.                                                      |
| **LLM-generated title**                              | Best UX, but requires an extra DIAL Core call after the first assistant response. Adds latency and cost.                                                               |

Simplest path for initial release: client-side truncation from `conversation.messages[0].content`. Backend option is preferred if the conversation list endpoint (`GET /conversations/list`) is added — it can return title as part of the metadata without fetching full message history.

---

### OQ-4 — Multi-language support ✅ Resolved

**Decision:** Arabic (`ar`) ships alongside English as the first RTL locale. See **FR-8** for the full set of derived requirements.

**What was done:**

- `ar.json` created with full translation coverage (`apps/chat/src/i18n/locales/ar.json`)
- `applyDocumentDirection` wired to `i18n.on('languageChanged')` — sets `document.documentElement.dir` and `lang` on every locale switch
- All layout components migrated from physical Tailwind utilities to CSS logical properties
- Directional icons mirrored via `rtl:scale-x-[-1]`
- Mobile slide-in panels use `start-0` + `ltr:-translate-x-full rtl:translate-x-full`
- Rules documented in `.claude/rules/rtl.md` and `AGENTS.md`

---

## Out of Scope (initial release)

- Slash commands and `@mention` support (FR-1.6, FR-1.7)
- Locales beyond English and Arabic
- Conversation sharing or export
- Admin / settings panel
- Mobile-native wrapper
