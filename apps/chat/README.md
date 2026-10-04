# Chat Application

## Custom Core API operations adapter

`apps/chat/src/server-api/custom-api.api.ts` exports `callCustomApiOperation(id, signal?)`,
a thin adapter over the generated `customApiApi.getCustomApiOperationRaw` (see
`libs/chat-api-client/README.md#custom-core-api-operations`) for the
deployment-configured, disabled-by-default BFF bridge documented in
`apps/chat-api/README.md#custom-core-api-operations`. It decodes the response
envelope's `data` field as `unknown` by reading `.raw.json()` directly, rather
than trusting the generated client's `{ [key: string]: unknown }` typing,
because the real value may be any JSON value — array, object, string, number,
boolean, or null.

This parent change ships no UI, no React state, and no startup request for
this adapter — it exists so a future client-specific change can call
`callCustomApiOperation` and add its own domain validation, presentation,
loading/error handling, and tests. `signal` supports cancellation the same way
other adapters in this folder do; there is no retry and no cache (every call
reaches the BFF, which itself applies no cache). The BFF accepts no query or
request body for this operation in v1 — parameterized calls and writes are a
separate, not-yet-built contract extension. Local BFF concurrency bounds
(32 total / 4 per caller in-flight) are independent of whatever business rate
limit Core's own configured Route enforces; see the BFF README for both.

## Manual scheduled-task runs

The feature-gated task detail page can start the saved task definition with
**Start now**. It sends one bodyless request and immediately prepends the
server-accepted run to History; it does not edit, resume, or otherwise change
the saved schedule. A completed one-time trigger or an expired recurring
window only ends automatic scheduling: a non-deleted task can still be run
manually.

While the returned run is in progress, the page checks its status every two
seconds for at most 70 seconds. The ordinary History refresh and its pagination
remain intact. A delayed or unavailable status keeps the last confirmed row and
offers a GET-only status refresh; the app never retries the non-idempotent start
request automatically. A credential-stage failure displays the existing
offline-credentials sign-in flow. Completing that sign-in leaves the failed row
in History and requires a new explicit Start now activation.

The 70-second observation deadline also cancels a pending status read. Returning
to a visible tab respects a Scheduler retry delay. A newly observed credentials
failure rechecks the route's credentials state, and a failed initial History
load retains its retry action alongside any accepted manual run.

Run history refreshes the shared conversation list to discover each chat's unread
state. Start now also refreshes it when a conversation first appears or its run
status changes, so a new manual run shows as unread without reloading the page.
Opening the chat from task History, sources History, the conversation panel, or a
direct URL marks it viewed, including when the panel is closed. Pending and
successful viewed writes survive stale list responses for the current user;
failed writes restore unread state and can be retried by leaving and reopening
the chat.
Rapidly opening several run chats queues their viewed writes within the current
app instance; older list responses cannot replace a newer successfully loaded
conversation snapshot. A newer failed request does not discard an older success.

History and Start now pass expected chat ids to
`ConversationsContext.refreshConversations(expectedIds?)`. Missing chats get up to
five additional list requests, two seconds apart after each request settles.
These requests share a retry queue in the provider and continue after a run
finishes or the user navigates to its chat. Discovery stops when metadata arrives,
the retry budget is exhausted, the user changes, or the provider unmounts.
An ordinary refresh without expected ids does not start retries.

## Scheduled task skills

Create/edit compose the reusable skills field into the scheduled-task form.
The field matches the model/agent input: search and favorites open in a desktop
dropdown or mobile bottom sheet, Browse opens the skill catalog, and the trailing
clear button removes the selected skill. Favorites come from the existing
personal, shared, and public skills collections and favorites context.
Task-form favorite rows omit the hover tooltip and View details action.
Skill selection is always available. Support comes from the draft model's
deployment entry, independent of chat's active model. Missing/false support
blocks saving a skill and immediately shows the shared chat message. Typed
BFF validation errors preserve the form; deployment-not-found errors do not
replace it with the missing-task page. A change in deployment skill support
clears a stale server capability error and revalidates the current draft,
allowing retry when support recovers without requiring the user to reselect
the model or skill.

Detail and conversation task summaries show a resolved skill name, falling
back to its full reference while metadata loads or cannot be read. These
lookups belong to app adapters; the libraries receive resolved values and
callbacks.

The AI DIAL Chat frontend — a React 19 single-page application served by
`apps/chat-api`. It is the user-facing surface for conversations, the entity
catalog, prompts, skills, scheduled tasks, publishing, sharing, and file
management, all backed by DIAL Core through the chat API.

For the structural map of the whole workspace — module boundaries, context
inventory, backend domains, SSE streaming, theming token flow — see
[`docs/architecture.md`](../../docs/architecture.md). This file covers what is
specific to running and developing `apps/chat`.

## Conversation reload recovery

After a reply finishes, the conversation page and application preview reload
the server's conversation. If that read fails, the received answer stays on
screen with a separate "Couldn't refresh this conversation" notification.
"Retry loading" repeats the read; it does not regenerate or save the answer.
The action is disabled while reading or generating, and successful
reconciliation clears the notification. Explicit backend save failures and
reads returning an unresolved empty placeholder still use the unsaved-answer
warning. A failed read alone establishes neither success nor failure of saving.

## Feature loading

The app uses automatic chunk splitting, UI Kit `/grid` and `/editors` imports,
the shared `/file-manager` entry and a lazy conversation publishing panel.
Heavy feature engines load when their features are activated.

## Celebration events

Set `UI_EVENT=halloween` or `UI_EVENT=new-year` on chat-api to select an event.
`none` or an omitted value disables events. The former `HALLOWEEN_ENABLED`
setting and `features.halloweenEnabled` flag are removed. Deploy the frontend
and backend together when migrating that setting. Event selection uses the
existing client-config refresh lifecycle; it is not a calendar scheduler.

Only `/` renders event decoration and intercepts its optional secret phrase.
Existing conversations send text normally. The current modules are:

| Event       | Click scenes                                                                                                                | Secret phrase                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `halloween` | Ghosts, connected web, bats, cat, witches, ghost train, portal, ravens, candy rain, invisible paw prints, dancing skeletons | `trick or treat` → random descending spiders, cauldron, mimic, pumpkin bowling or mummy |
| `new-year`  | Snow, confetti, flying sleighs                                                                                              | `happy new year` → confetti                                                             |

The celebrations themselves live in
[`@epam/ai-dial-celebrations`](../../libs/celebrations/README.md), which documents
every scene, decoration behavior and the runtime. The app only adapts itself to
the library in [`CelebrationHost`](src/context/CelebrationHost.tsx): it passes the
configured event on `/` once the user config is ready, the navigation key as the
reset key, labels translated from the existing `halloween.*` and `newYear.*` keys,
the success toast as the notification sink, `useIsMobile`, and the composer,
starter-list and history-panel anchors. The app keeps every scene enabled.

### Adding an event

1. Add the event to the library as a new entry point; see the library README.
2. Register its loader in `EVENTS` and its translated labels in
   [`CelebrationHost`](src/context/CelebrationHost.tsx), adding the keys to
   `translation-keys.ts` and `en.json`.
3. New IDs require no backend enum, provider, header or composer changes.

## Content Security Policy

Production HTML is served by `chat-api` with a fresh style nonce. Vite inserts
the nonce placeholder and metadata. The app-owned build adapter in
`tools/vite/csp-nonce.mjs` adds that nonce to style elements created by the
installed OOXML, UI Kit, and file-manager distributions and the local overlay
style helper. This covers their independently bundled grid runtimes without
loading those features eagerly. It does not patch browser DOM APIs or authorize
HTML-supplied styles. Published libraries remain independent of this host
configuration.

Deploy this build together with the backend. See the backend's
[CSP rollout and reporting settings](../chat-api/README.md#content-security-policy).
Legacy builds without the nonce marker can run with `CSP_MODE=report-only` and a
startup warning; rebuild with nonce support before enabling `enforce`.
The Vite development server does not enforce the production policy; validate
using built assets served by the backend before enabling enforcement.

Run `npm exec -- nx run @epam/chat:test-csp-browser` to build a fixture with the
actual application Vite configuration and check the installed UI Kit grid, file
manager, PDF/DOCX/XLSX previews, and rejected injections in Chromium under strict CSP.
The test requires the Playwright Chromium browser (`npm exec -- playwright install chromium`).

## Features

### Conversations

- Streaming assistant responses over SSE, with agent processing stages shown live
- Message editing, regeneration, copy, like/dislike, and per-message actions
- Attachments — upload, drag-and-drop, clipboard paste, and an inline viewer for
  images, PDFs, code, JSON, markdown, and plain text
- Citations and source panels for retrieval-grounded answers
- Conversation history sidebar with search, grouping, tabs, and renaming
- Import/export queue for moving conversations in and out
- LLM-assisted conversation naming when the backend enables a utility model

### Voice dictation

With voice input enabled, the microphone button (`Dictate` tooltip) records one complete audio file. Nothing
is uploaded or recognized during capture. After Stop, the microphone is released,
the complete file is validated against `TRANSCRIBE_SIZE_LIMIT_BYTES` and uploaded
once, and its transcription is appended to the existing draft. The configured ASR
deployment takes precedence over the selected audio-capable model. Audio is not
added to the message attachment tray, and the message is not sent automatically.

The waveform replaces the textarea during recording and processing in both voice
modes. Keyboard text entry is unavailable; the existing draft is preserved. After
recognition the textarea returns and receives focus. Cancellation aborts pending
requests and ignores late results; cancellation and errors preserve the draft.

`Record voice` in the add menu, immediately before Chat settings, records an audio
attachment without calling transcription. It is available when the selected model
accepts audio, attachments and voice input are enabled, and the assistant is not
streaming. Its file uses the existing attachment validation/upload pipeline.
Configured ASR can enable Dictate even for a model that cannot accept audio files.

Temporary recognition failures (HTTP 429, 502, 503, 504) get up to two retries of
the same uploaded file. The app honors `Retry-After`; without it, 429/503 wait
30 then 60 seconds, and 502/504 wait 2 then 4 seconds. Total retry waiting is
limited to 90 seconds per recording. A longer requested delay ends processing
with an unavailable message. Cancellation aborts both requests and retry timers.

### Entities and authoring

- Catalog of models, applications, tools, prompts, and skills, with favorites,
  topic filtering, and grid/list views
- Editors for applications, toolsets, custom apps, prompts, and skills
- Prompt selection and parameter substitution directly in the composer
- Scheduled tasks — create, edit, inspect run history (feature-gated)
- Publishing to shared folders and share-by-link with recipient management
- DIAL file manager for browsing personal, shared, and organization files

### Platform

- OIDC login through the backend BFF, with a session cookie and transparent
  token refresh; interactive toolset sign-in during a completion
- Overlay mode — the whole app can run embedded in a host page over the
  `postMessage` protocol from `@epam/ai-dial-chat-overlay`
- Runtime theming from `/api/themes`, applied as CSS custom properties
- Server-driven UI feature toggles, announcement banner, and footer message
- Mobile-first responsive layout with bottom sheets and a mobile nav bar
- Internationalization through `react-i18next`, with RTL direction switching

## Prerequisites

- Node.js 24 or higher
- npm 11 or higher
- A running `apps/chat-api` instance (the frontend has no direct DIAL Core access)

## Getting Started

### 1. Install Dependencies

From the root of the monorepo:

```bash
npm install
```

### 2. Development Mode

The frontend calls the API through a relative `/api` prefix, so start both:

```bash
npm run start:all
```

Or serve the frontend alone against an already-running API:

```bash
npm exec nx serve chat
```

The application will be available at `http://localhost:4207`.

### 3. Production Build

```bash
npm exec nx build chat
```

The built files are output to `apps/chat/dist/` and served by `chat-api` in
production — every route except `/api/*` falls through to the SPA.

## Project Structure

```
apps/chat/
├── src/
│   ├── app/                     # Root component, routing, layout shell
│   ├── components/              # Feature components (see below)
│   ├── constants/               # Route helpers, translation keys, feature keys
│   ├── context/                 # React context providers (see below)
│   ├── hooks/                   # Shared hooks, incl. breakpoint/useBreakpoint
│   ├── i18n/                    # i18n configuration and locale JSON
│   ├── models/                  # App-level domain models
│   ├── pages/                   # Route-level pages
│   ├── server-api/              # Backend adapters — the only REST-aware layer
│   ├── types/                   # Enums and shared types (incl. ROUTES)
│   ├── utils/                   # App-level utilities
│   ├── main.tsx                 # Entry point
│   └── styles.scss              # Global styles
└── README.md                    # This file
```

Most UI is composed from the workspace libraries in `libs/*` — this app supplies
the data, translated strings, and callbacks they need. See the
[Libraries table](../../README.md#libraries) for what each one owns.

### Routes

Route paths are declared once in the `ROUTES` enum
(`src/types/routes.ts`); build parameterized paths with the helpers in
`src/constants/routes.ts` rather than by string concatenation.

| Route                                 | Page                                           |
| ------------------------------------- | ---------------------------------------------- |
| `/`                                   | Active conversation (or the new-chat composer) |
| `/conversations/:id`                  | A specific conversation                        |
| `/conversations/shared/:invitationId` | Accept a shared-conversation invitation        |
| `/catalog`                            | Entity catalog                                 |
| `/catalog/shared/:invitationId`       | Accept a shared-entity invitation              |
| `/apps-editor`                        | Application editor                             |
| `/toolset-editor`                     | Toolset editor                                 |
| `/toolset-editor/callback`            | Registered OAuth redirect for toolset IdPs     |
| `/custom-app-editor`                  | Custom application editor                      |
| `/prompt-editor`                      | Prompt editor                                  |
| `/skill-editor`                       | Skill editor                                   |
| `/auth/toolset-signin`                | Interactive toolset sign-in                    |
| `/files`                              | DIAL file manager                              |
| `/scheduled-tasks`                    | Scheduled tasks list (feature-gated)           |
| `/scheduled-tasks/new`                | Create a scheduled task                        |
| `/scheduled-tasks/:scheduleId`        | Scheduled task detail and run history          |
| `/scheduled-tasks/:scheduleId/edit`   | Edit a scheduled task                          |
| `/login`                              | Login entry point                              |

Pages are lazy-loaded behind `Suspense` and wrapped in a `RouteErrorBoundary`,
so a failure in one route does not take the shell down.

### Contexts

State that spans routes lives in providers under `src/context/`:

| Context                       | Owns                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `AppConfigContext`            | Server-resolved app configuration                       |
| `UiFeaturesContext`           | Enabled UI feature flags                                |
| `UserConfigContext`           | Per-user persisted preferences                          |
| `ThemeContext`                | Active theme and its CSS custom properties              |
| `ConversationsContext`        | Conversation list, selection, and mutations             |
| `ConversationPanelContext`    | Sidebar panel state                                     |
| `GenerationContext`           | In-flight generation and streaming state                |
| `DeploymentsContext`          | Models, applications, and their capabilities            |
| `PromptsContext`              | Prompts and favorites                                   |
| `SkillsContext`               | Skills                                                  |
| `FavoriteApplicationsContext` | Favorited applications                                  |
| `SourcesSidebarContext`       | Conversation sources panel                              |
| `ActiveScheduledTaskContext`  | The scheduled task being viewed or edited               |
| `ClientChannelContext`        | Server-initiated interactions (toolset sign-in prompts) |
| `NotificationContext`         | Toast notifications                                     |
| `SheetNavigationContext`      | Mobile bottom-sheet navigation stack                    |
| `context/auth`                | Session state, `SessionGuard`, and sign-in/out          |
| `context/overlay`             | Overlay-mode bridges for the postMessage protocol       |

## Configuration

The frontend reads no environment variables of its own at runtime — everything
is resolved by `chat-api` and delivered through `/api/v1/client-config`,
`/api/v1/user-config`, and `/api/themes`. Configure behaviour in the API's
environment instead;
see [`apps/chat-api/README.md`](../chat-api/README.md) and
`apps/chat-api/.env.template`.

Values that most visibly change this app:

- `THEMES_CONFIG_URL` — theme configuration source; see
  [`docs/theme-customization.md`](../../docs/theme-customization.md)
- `ENABLED_UI_FEATURES` — the complete list of enabled UI features
- `DEFAULT_DEPLOYMENT` — the deployment preselected for a new conversation
- `ANNOUNCEMENT_*` / `ANNOUNCEMENTS` / `FOOTER_HTML_MESSAGE` — banner and footer copy
- `OVERLAY_ENABLED` / `ALLOWED_IFRAME_ORIGINS` — overlay embedding
- `SCHEDULED_TASKS_ENABLED` — the scheduled tasks route and its nav entry

## Styling

### Tiers

1. **Tailwind utilities** for layout and spacing — the default.
2. **SCSS modules** (`*.module.scss`) when a component needs CSS custom
   properties, pseudo-element styling, or state selectors Tailwind cannot reach.
3. **Global styles** in `src/styles.scss`, which imports Tailwind's layers.

The styling contract shared with `libs/*` — CSS variable naming, what belongs in
a module versus a utility class, and the `styles={{ colors, typography }}` prop
shape — is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

### Breakpoints

`tailwind.config.js` defines exactly two named screens:

| Screen    | Query               |
| --------- | ------------------- |
| `mobile`  | `max-width: 1279px` |
| `desktop` | `min-width: 1280px` |

Do not introduce `sm:`/`md:`/`lg:`/`xl:` or tablet variants. When a component
must branch in JavaScript, use `useBreakpoint` / `useIsMobile` from
`src/hooks/breakpoint/useBreakpoint.ts` instead of reading `window.innerWidth`.

### RTL

The UI must work in right-to-left locales. Use logical Tailwind utilities
(`ms-*`, `pe-*`, `text-start`, `start-*`, `border-s-*`) rather than physical
ones, and mirror directional icons with `rtl:scale-x-[-1]`. The full rule set is
in [`.claude/rules/rtl.md`](../../.claude/rules/rtl.md).

## Internationalization (i18n)

### Supported languages

- English (`en`) — the default, and the only locale shipped today

Adding one is a code change, not deployment configuration: create
`src/i18n/locales/<lang>.json` with every key from `en.json`, register it in
`src/i18n/config.ts`, add it to the language selector, and — for a right-to-left
language — add its code to `RTL_LANGUAGES` so `document.documentElement.dir`
flips. `ar`, `he`, `fa`, and `ur` are already listed there.

### Language detection

The app resolves the active language from, in order:

1. `localStorage` (saved preference)
2. Browser navigator settings

### Adding translations

1. Add the key to `src/i18n/locales/en.json` **and** declare it in the matching
   string enum in `src/constants/translation-keys.ts`.
2. Reference it through the enum — never pass a raw string literal to `t()`:

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent: FC<Props> = () => {
  const { t } = useTranslation();
  return <div>{t(ChatI18nKeys.WelcomeScreen)}</div>;
};
```

Before adding a key, grep `en.json` for the English string — generic action
labels ("Copy", "Cancel", "Save") already live under `ButtonsI18nKeys` and
should be reused rather than re-declared per feature.

Every `aria-label` must be translated too: libraries expose label props with
English defaults, and this app passes `t(...)` values in.

## Testing

### Reply to selected message text

Reply stays hidden while selection is in progress and appears after pointer release
or completion of keyboard selection, including repeated selections.

Select text inside one completed user or assistant message and activate **Reply**
to add it to the current composer as `reply-<uuid>.txt`. The UTF-8 file contains
the selected visible text, including whitespace and Unicode. The typed draft is
preserved; Reply focuses the composer without sending. The file uses normal
attachment upload, size/count validation, preview, retry, removal and URL-based
send behavior. A loading or failed upload blocks sending; removing its draft tile
does not delete the uploaded file.

Reply is available only in an editable conversation whose selected model permits
text attachments. It is unavailable during streaming or message editing, with
disabled input/files, and in read-only views. Cross-message selections, attachment
viewers, control-only selections and tool output are excluded. Inline citations,
annotations and links within selected message text do not hide Reply; the file
preserves the browser-selected text, including selected marker labels. Tab reaches Reply after
selection; Enter/Space activates it and Escape dismisses it. Touch and RTL use the
same flow.

```bash
# Run all tests
npm exec nx test chat

# Watch mode
npm exec nx test chat -- --watch

# With coverage
npm exec nx test chat -- --coverage
```

Test configuration:

- Environment: `jsdom`
- Coverage provider: `v8`
- Coverage output: `./test-output/vitest/coverage`

Tests query by role, label, and semantic text — this repository does not use
`data-testid`.

## Linting

```bash
# Run linter
npm exec nx lint chat

# Auto-fix linting issues
npm exec nx lint chat -- --fix
```

## Accessibility

The app targets WCAG 2.1 AAA. In practice that means decorative icons inside
labeled controls are `aria-hidden`, toggles expose `aria-pressed` /
`aria-expanded`, hidden panels with focusable children use `inert` rather than
`aria-hidden`, dynamic feedback is announced through an `aria-live` status
region, and text colors resolve to at least 7:1 contrast. The full pattern list
is in [`.claude/rules/a11y.md`](../../.claude/rules/a11y.md).

## TypeScript

- Strict mode enabled, `moduleResolution: "bundler"`
- Relative imports omit source extensions (`./Component`, not `./Component.tsx`)
- Custom type definitions in `src/i18n/i18next.d.ts`
- String enums, not string-literal unions, for finite value sets

## Browser Support

Modern evergreen browsers: Chrome, Firefox, Safari, and Edge (latest).

## Related Documentation

- [Architecture](../../docs/architecture.md)
- [Technical Requirements](../../docs/technical-requirements.md)
- [Chat API](../chat-api/README.md)
- [Theme Customization](../../docs/theme-customization.md)
- [Responses API Integration](../../docs/responses-api-integration.md)
- [Authentication](../../docs/auth/auth-bff-encrypted-cookie.md)
- [Chat Overlay Migration Guide](../../docs/chat-overlay-migration-guide.md)

## Contributing

1. Create a feature branch from `development`
2. Make your changes with tests
3. Ensure all tests pass: `npm exec nx test chat`
4. Ensure linting passes: `npm exec nx lint chat`
5. Update the docs a change affects — including `docs/architecture.md` when the
   structure changes — in the same commit
6. Create a pull request to `development`

## License

Copyright © EPAM Systems. Released under the
[Apache License 2.0](../../LICENSE).

### Application credentials in Catalog and Quick Apps

Catalog application details expose API-key, OAuth and DIAL-native external-service
credentials when `liveChatInteraction` is enabled. Each service is independent and
credential changes are refreshed immediately. The Chat `ApplicationCredentials`
adapter maps API data and translations into `@epam/ai-dial-catalog` forms, which
reuse the toolset credentials UI. Metadata loading lives in
`useApplicationCredentials` from `@epam/ai-dial-chat-hooks`; Chat supplies the configured clients and the existing login/logout flow.
The Quick Apps iframe receives
`applicationCredentials=true` when the host supports these forms. Sending
`{ type: 'REQUEST_APPLICATION_CREDENTIALS', appId: 'applications/public/my-agent' }`
from that iframe opens the same host dialog; no credentials are sent through
`postMessage`. See [the authentication flow](../../docs/auth/auth-bff-encrypted-cookie.md#proactive-application-credential-forms).

## AI text refinement

Skill and scheduled-task forms opt into Description and Instructions refinement only when the backend returns `config.aiTextRefinementAvailable: true`. The host selects one of four purposes and passes a stable callback, cancellation signal, and translated labels to the libraries. Fields remain editable during requests; editing the active field cancels it. Save waits for refinement, and Undo is local to the current draft.

Run `npm exec -- nx run @epam/chat:test-refinement-browser` for Chromium checks of both forms at 360/900/1280/1920px, in LTR and Arabic RTL, using deterministic callbacks without a live model. Geometry evidence is written to `tmp/text-refinement-browser/geometry.json`.
