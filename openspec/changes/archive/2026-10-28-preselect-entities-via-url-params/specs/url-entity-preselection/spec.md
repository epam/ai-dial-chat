# Spec Delta

## Purpose

Lets an external application link into DIAL Chat with a deployment, a skill and/or a prompt preselected, through URL query parameters, behaving like the catalog's "Use in chat" action but without switching Chat into an isolated view and without saving the deployment as the user's preference.

## ADDED Requirements

### Requirement: Query parameters preselect a deployment, a skill and a prompt on the new-conversation route

The new-conversation route (`/`, rendered by `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`) SHALL read three optional query parameters on arrival and apply them as the catalog's "Use in chat" action does (see the `catalog-use-in-chat` capability):

- `deployment-id=<id>` — preselects a Model, Agent or Application as the deployment for a new conversation.
- `skill-id=<skills/{bucket}/{path}>` — adds that skill to the message input as a `/{name} ` mention.
- `prompt-id=<prompts/{bucket}/{path}>` — applies that prompt: a body without `{{parameter}}` placeholders seeds the message input; a body with parameters opens the "Prompt parameters" popup.

The parameters MAY be combined in any subset. An absent or empty parameter SHALL be a no-op; each value is otherwise interpreted by its own requirement below (a deployment id also resolves by reference or percent-encoding variant, while skill and prompt ids match exactly). Ids containing reserved characters are passed percent-encoded in the URL. The parameters SHALL have no effect on any route other than `/`. In overlay (iframe host) mode, and while isolated view is active, they SHALL be neither applied, reported through a notification, nor removed from the URL.

Applying the parameters SHALL NOT switch Chat into an isolated view: the navigation menu, agent picker and new-conversation controls SHALL stay visible and no UI-feature override SHALL be applied. A prompt body SHALL never be carried in the URL; Chat SHALL load it by the `prompt-id`.

Unlike the catalog's "Use in chat" — which saves the picked deployment as the user's own preference — a `deployment-id` SHALL be applied without persisting it (see the deployment requirement below). This difference is intentional and SHALL NOT be "aligned" with the catalog.

**State ownership:** `ConversationRoute` keeps owning the sinks (deployment selection through `DeploymentsContext`, the composer seed, the skill mention state, the parameters popup); a single hook in `apps/chat/src/hooks/` applies each URL source through them once. No new context is introduced and nothing is persisted. Failures are shown through the existing notification context, which announces them through its live region; the feature adds no layout and has no RTL impact. It is gated only by the existing `skills` and `prompts` UI features for the parameters that need them.

#### Scenario: Parameter absent leaves the route untouched

- **WHEN** the user opens `/` without `deployment-id`, `skill-id` or `prompt-id`
- **THEN** the deployment selection, message input and notifications are exactly as before this capability

#### Scenario: deployment-id alone preselects the deployment

- **WHEN** the user opens `/?deployment-id=<id>` and `<id>` names a loaded, selectable, chat-capable deployment
- **THEN** the new-conversation screen shows that deployment as selected
- **AND** the navigation menu, agent picker and new-conversation controls remain visible

#### Scenario: skill-id alone adds a skill mention

- **WHEN** the user opens `/?skill-id=skills/<bucket>/<path>` for an accessible skill
- **THEN** the message input contains that skill's `/{name} ` mention rendered through `ChatSkill`
- **AND** the selected deployment is the one it would have been without the parameter

#### Scenario: prompt-id without parameters seeds the message input

- **WHEN** the user opens `/?prompt-id=prompts/<bucket>/<path>` for a prompt whose body has no `{{parameter}}` placeholders
- **THEN** the message input contains that prompt's body and the selected deployment is unchanged

#### Scenario: prompt-id with parameters opens the parameters popup

- **WHEN** the user opens `/?prompt-id=prompts/<bucket>/<path>` for a prompt whose body contains `{{parameter}}` placeholders
- **THEN** the "Prompt parameters" popup opens for that prompt, as it does from the catalog's "Use in chat"

#### Scenario: Parameters are ignored outside the new-conversation route

- **WHEN** the user opens `/conversations/<id>?deployment-id=<id>`
- **THEN** the conversation's own deployment and message input are unchanged

#### Scenario: Overlay mode ignores the parameters

- **WHEN** Chat runs in overlay mode and the URL carries `deployment-id`, `skill-id` or `prompt-id`
- **THEN** nothing is applied, no notification is shown and the URL is left as it is

#### Scenario: Isolated view ignores the parameters

- **WHEN** the URL is `/?isolated-model-id=a&skill-id=<skills/...>&prompt-id=<prompts/...>`
- **THEN** isolated view applies as today, neither `skill-id` nor `prompt-id` is applied (isolated view disables the `skills` and `prompts` features), no notification is shown and the URL is left as it is

#### Scenario: A failure is announced, not silent

- **WHEN** a `skill-id` or `prompt-id` fails validation or loading
- **THEN** an error notification is shown through the notification context

### Requirement: Each URL parameter is consumed once and removed individually

As soon as a parameter has been applied or has failed, `ConversationRoute` SHALL remove exactly that parameter from the URL with a history `replace`, leaving every other query parameter, the hash and any pending router state intact, so that a refresh or later back-navigation does not re-apply it. Removal SHALL be order-independent: several parameters settling in the same tick all end up removed and nothing else is lost. Each source SHALL be applied at most once per arrival — including in React StrictMode development, where effects run, clean up and run again, and without the unbounded render loop of [#9109](https://github.com/epam/ai-dial-chat/issues/9109) — and a source is considered applied only when its result has been applied or has failed, never merely when its loading started.

The one-shot router-state consumers of `ConversationRoute` SHALL clear their state with a `replace` navigation that keeps the URL's query string and hash as they are *at that moment* (not as of the last render), so they can neither remove a URL parameter that is still pending nor bring back one that has just been removed. A cleanup that settles after the user has left `/` SHALL NOT rewrite the new route. Every cleanup is a history `replace` and therefore changes the location key; a late cleanup can reset the Custom Viewer start gate of a deployment that has one after the user pressed "Start" — a known limitation, not a requirement to avoid.

When one-shot router state (from in-app navigation) and a URL parameter supply the same source, the router state SHALL win and the URL parameter SHALL still be removed.

#### Scenario: Refresh does not re-apply

- **WHEN** the user opens `/?deployment-id=<id>&skill-id=<skills/...>`, both are applied, and the user reloads the page
- **THEN** the URL no longer contains either parameter
- **AND** the reload resolves the deployment through the normal default-selection chain and adds no skill mention

#### Scenario: Unrelated query parameters and hash survive

- **WHEN** the user opens `/?deployment-id=<id>&skill-id=<skills/...>&foo=bar#h` and both parameters settle
- **THEN** the URL is `/?foo=bar#h`

#### Scenario: A pending parameter survives the settling of another

- **WHEN** `deployment-id` settles while the `skill-id` listing is still loading
- **THEN** `skill-id` is still in the URL until it, in turn, is applied or fails

#### Scenario: Each source is applied once, also in StrictMode

- **WHEN** `ConversationRoute` mounts under StrictMode with a `skill-id` and a `prompt-id`
- **THEN** the skill is seeded and the prompt is applied exactly once each, and the prompt is loaded despite the development double effect

#### Scenario: Router state wins over the URL

- **WHEN** an in-app navigation to `/` carries router state `{ deploymentId: 'a' }` and the URL also carries `deployment-id=b`
- **THEN** deployment `a` is selected and `deployment-id` is removed from the URL

#### Scenario: A router-state clear does not resurrect a removed parameter

- **WHEN** `ConversationRoute` mounts with router state `{ skillId }` and the URL `?deployment-id=x`, and both are consumed in the same tick
- **THEN** the URL ends without `deployment-id`

### Requirement: deployment-id preselects without persisting and falls back for unknown ids

A resolved `deployment-id` SHALL be selected through `DeploymentsContext.restoreSelectedItemId`: `setSelectedItemId` SHALL NOT be called and no user-config write SHALL be dispatched. The value SHALL be matched with the deployment id-or-reference lookup, so a `reference` or a percent-encoding variant of an id resolves to the catalog deployment.

Whether the id is known SHALL be decided only after `DeploymentsContext` has finished loading. The id SHALL be treated as unknown — Chat SHALL select the default deployment as on a plain new chat and show a warning notification — when it matches no deployment, matches a deployment hidden by the operator (`isHidden`), or matches a deployment whose declared `interfaces` do not include `chat`. This includes applications that only declare a custom UI (consistent with the catalog, which hides "Use in chat" for them; supporting a Custom Viewer start from a link is out of scope) and toolset ids, which are not deployments. When the deployments listing itself failed, Chat SHALL fall back to the default and show an **error** notification instead of the "not found" warning.

While `deployment-id` is pending or once a known id has been applied, `ConversationRoute` SHALL NOT replace the selection with the default (see the `conversation-deployment-selection` capability). When isolated view is active, `deployment-id` SHALL be ignored (see the `isolated-model-view` capability).

**i18n:** `urlPreselection.deploymentNotFoundTitle`, `urlPreselection.deploymentNotFoundMessage` (unresolved id interpolated), `urlPreselection.deploymentsLoadFailedTitle`, `urlPreselection.deploymentsLoadFailedMessage`.

#### Scenario: Selection is not persisted

- **WHEN** the user opens `/?deployment-id=<id>` for a known deployment while their saved preference is a different deployment
- **THEN** the selected deployment is `<id>`
- **AND** `setSelectedItemId` is not called and no user-config update is dispatched

#### Scenario: Unknown id falls back with a warning

- **WHEN** the user opens `/?deployment-id=does-not-exist` and deployments have finished loading without a match
- **THEN** the default deployment is selected and a warning notification states that the requested deployment was not found

#### Scenario: A hidden deployment is treated as unknown

- **WHEN** `deployment-id` names a deployment with `isHidden` set
- **THEN** the default deployment is selected and the "not found" warning is shown

#### Scenario: A deployment without the chat interface is treated as unknown

- **WHEN** `deployment-id` names a deployment whose declared `interfaces` do not include `chat` (including a custom-UI-only application)
- **THEN** the default deployment is selected and the "not found" warning is shown

#### Scenario: A toolset id is treated as unknown

- **WHEN** `deployment-id` is the id of a toolset
- **THEN** the default deployment is selected and the "not found" warning is shown

#### Scenario: Deployments listing failed

- **WHEN** the user opens `/?deployment-id=<id>` and loading deployments fails
- **THEN** the default selection path proceeds and an error notification (not the "not found" warning) is shown

#### Scenario: Reference and encoded ids resolve

- **WHEN** `deployment-id` is the `reference` of a deployment, or a percent-encoding variant of its id
- **THEN** that deployment is selected under its catalog id

### Requirement: skill-id is validated against the user's skill listings

A `skill-id` SHALL be applied only after the skills listing has settled, only when the `skills` UI feature is enabled, and only when the value is a well-formed `skills/{bucket}/{path}` resource id that exactly matches the `url` of a skill in the user's own, shared-with-me or public skills. The mention SHALL then be seeded exactly as the catalog's "Use in chat" does (`/{name} ` with the listed name and the skill's url as the mention anchor) without changing the selected deployment. A match in the listings always wins; a listing `error` counts as a failure only when there is no match.

When the value is malformed, absent from all three listings after they settle, the listing failed without a match, or the `skills` feature is disabled, Chat SHALL show an error notification, SHALL leave the message input unchanged, and SHALL remove `skill-id` from the URL.

When the selected deployment does not have `features.skillsSupported === true`, the mention SHALL render in its `isUnsupported` error state and sending SHALL be blocked, as for the catalog's "Use in chat" on a skill (see the `skill-input-attachment` capability).

**i18n:** `urlPreselection.skillUnavailableTitle`, `urlPreselection.skillUnavailableMessage`.

#### Scenario: Unknown skill

- **WHEN** the user opens `/?skill-id=skills/<bucket>/missing` and the skills listing has settled without that skill
- **THEN** an error notification is shown, the message input is unchanged and `skill-id` is removed from the URL

#### Scenario: Malformed skill id

- **WHEN** the user opens `/?skill-id=not-a-skill-url`
- **THEN** an error notification is shown and the message input is unchanged

#### Scenario: Skills feature disabled

- **WHEN** the `skills` UI feature is disabled and the URL carries a valid `skill-id`
- **THEN** an error notification is shown and the message input is unchanged

#### Scenario: Skill used with a deployment without skills support

- **WHEN** the user opens `/?deployment-id=<id>&skill-id=<skills/...>` and the deployment's `features.skillsSupported` is not `true`
- **THEN** the skill mention renders in its `isUnsupported` error state and sending is disabled

#### Scenario: Skill name is not guessed before listings load

- **WHEN** the user opens `/?skill-id=<skills/...>` on a cold load while the skills listing is still loading
- **THEN** no mention is seeded until the listing settles, and the mention then uses the listed skill name

### Requirement: prompt-id loads the prompt by id and applies it like the catalog

A `prompt-id` SHALL be validated as a well-formed `prompts/{bucket}/{path}` resource id and the prompt SHALL then be read by that id through the same read the catalog uses for that kind of prompt: an organisation prompt (bucket `public`) through the organisation prompt read, any other prompt through the personal/shared prompt read. The `prompts` UI feature being disabled SHALL make the prompt unavailable.

On success, a body without `{{parameter}}` placeholders SHALL seed the message input and a body with parameters SHALL open the "Prompt parameters" popup with the prompt's `id`, `name`, `description` and `content` — the same outcomes as the catalog's "Use in chat". The selected deployment SHALL NOT change.

On a malformed id, a disabled `prompts` feature, or a failed read (not found, no access, network), Chat SHALL show an error notification (carrying the request id when the API provides one), SHALL leave the message input unchanged, and SHALL remove `prompt-id` from the URL.

**i18n:** `urlPreselection.promptUnavailableTitle`, `urlPreselection.promptUnavailableMessage`.

#### Scenario: Organisation prompt resolves by id

- **WHEN** the user opens `/?prompt-id=prompts/public/<path>` for an organisation prompt
- **THEN** the prompt is loaded through the organisation prompt read and applied as for a catalog "Use in chat"

#### Scenario: Personal or shared prompt resolves by id

- **WHEN** the user opens `/?prompt-id=prompts/<bucket>/<path>` for their own or a shared prompt
- **THEN** the prompt is loaded through the personal/shared prompt read and applied

#### Scenario: Inaccessible prompt

- **WHEN** the user opens `/?prompt-id=prompts/<other-bucket>/<path>` and the read fails with not found or forbidden
- **THEN** an error notification is shown and the message input is unchanged

#### Scenario: Body never travels in the URL

- **WHEN** a prompt is applied through `prompt-id`
- **THEN** the URL contained only the prompt id and never the prompt body

### Requirement: Text inserted into a composer holding seeded text lands after it

When the message input (`libs/conversation-input/src/components/Input/Input.tsx`) mounts already holding a `message` — which happens when a link seeds the composer before its lazily loaded chunk renders — and is autofocused, it SHALL place the caret at the end of that text. Text inserted at the caret into a composer the user has never focused and whose selection is still at the browser's default start position (`useTextInsertion`) SHALL be inserted at the end of the text. Once the user has focused the composer, or a host has set a selection, an insertion SHALL go at that caret. The input SHALL NOT change the selection of a composer that is not focused, because doing so moves focus in some WebKit versions. The result is that text submitted from the "Prompt parameters" popup lands after a seeded skill mention and not in front of it.

#### Scenario: Insertion after a cold seed lands after the mention

- **WHEN** the composer mounts holding `/my-skill ` and text is then inserted at the caret
- **THEN** the message reads `/my-skill ` followed by the inserted text, in a real browser, with and without autofocus

#### Scenario: Insertion after a warm seed lands after the mention

- **WHEN** the composer is already mounted and is then seeded with `/my-skill `, and text is then inserted at the caret
- **THEN** the message reads `/my-skill ` followed by the inserted text

#### Scenario: A caret the user left behind is respected

- **WHEN** the user focuses the composer, places the caret inside the text, leaves it, and text is then inserted
- **THEN** the text is inserted at that caret

#### Scenario: An unfocused composer's selection is left alone

- **WHEN** the composer mounts holding text without being focused
- **THEN** the input does not call `setSelectionRange` on it

### Requirement: skill-id and prompt-id combine as skill mention first, then prompt text

When both `skill-id` and `prompt-id` resolve successfully:

- For a prompt without parameters, the message input SHALL contain the skill's `/{name} ` mention followed immediately by the prompt body, with the mention remaining a recognised skill mention. A `/otherSkill` written inside the prompt body SHALL NOT be turned into a mention (as in the catalog's plain-prompt seeding).
- For a prompt with parameters, the skill mention SHALL be seeded first and the "Prompt parameters" popup SHALL open; when the user submits the popup, the resolved prompt text SHALL be inserted at the caret, after the mention, without discarding it.

When only one of the two resolves, that one SHALL be applied and the other SHALL surface its own error notification. The outcome SHALL NOT depend on the order in which the two asynchronous resolutions complete. When the selected deployment shows a start gate or a disabled input, the text is still seeded into that (disabled) input, as for router-state seeding today, and becomes usable if the user selects another deployment.

#### Scenario: Skill and plain prompt

- **WHEN** the user opens `/?skill-id=<skills/...>&prompt-id=<prompts/...>` and the prompt has no parameters
- **THEN** the message input reads `/{skillName} {promptBody}` with the skill mention intact

#### Scenario: Skill and parameterized prompt

- **WHEN** the user opens the same link with a parameterized prompt and submits the "Prompt parameters" popup
- **THEN** the skill mention is still present and the resolved prompt text follows it

#### Scenario: A start gate does not stop the parameters being consumed

- **WHEN** the selected deployment shows a Custom Viewer start gate or a disabled input instead of the composer and the URL carries `skill-id` or `prompt-id`
- **THEN** the parameter is still consumed and removed, and the text is seeded into the disabled input

#### Scenario: Skill is valid but prompt is not

- **WHEN** `skill-id` resolves and `prompt-id` fails to load
- **THEN** the skill mention is seeded, an error notification is shown for the prompt, and no prompt text is added

#### Scenario: Prompt is valid but skill is not

- **WHEN** `prompt-id` resolves and `skill-id` is unknown
- **THEN** the prompt is applied as when used alone and an error notification is shown for the skill

#### Scenario: Completion order does not matter

- **WHEN** the prompt read resolves before the skills listing settles, or after it
- **THEN** the resulting message input is identical
