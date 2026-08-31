## MODIFIED Requirements

### Requirement: User config carries a prompts favourites section

`UserConfig` (`apps/chat-api/src/user-config/dto/user-config.dto.ts`) SHALL carry a `prompts: PromptsConfig` section holding `installed: string[]` — the full DIAL resource path (`prompts/{bucket}/{path}`) of each prompt the user has favourited, matching `PromptResponseDto.id`'s shape (see `prompts-api`). `PromptsConfigDto` SHALL expose it through Swagger so the generated client types it.

`CURRENT_CONFIG_VERSION` SHALL become `5`, and `migrateConfig` SHALL populate and normalise `prompts.installed` for every earlier stored shape:

- absent or non-object input → `[]`
- v1 flat shape (`pinnedConversationIds` at the root) → `[]`
- v2 / v3 shape without a `prompts` key → `[]`
- v4 shape → the stored array, with non-string entries dropped, then **qualified**: an entry that does not already start with `prompts/` is a bare bucket-relative path from before this change and is rewritten to `prompts/{userBucket}/{entry}`; an entry that already starts with `prompts/` (a shared prompt favourited under the old scheme, which was already qualified — see `prompt-catalog-integration`) is left untouched
- v5 shape → the stored array, with non-string entries dropped, unchanged otherwise (every entry is already a full resource path)

`DEFAULT_USER_CONFIG` MUST NOT be handed out directly, because the service mutates the installed and pinned arrays in place. `createDefaultUserConfig()` SHALL return a fresh copy, and every default-config path in `UserConfigService` SHALL use it.

#### Scenario: A v3 config gains an empty prompts section

- **WHEN** `migrateConfig` reads a stored v3 config with no `prompts` key
- **THEN** the result has `version: 5` and `prompts: { installed: [] }`
- **AND** `conversations.pinnedIds`, `toolsets.installed`, and `deployments` are preserved unchanged

#### Scenario: A v4 config's bare-path favourites are qualified with the user's own bucket

- **WHEN** `migrateConfig` reads a v4 config for user with bucket `my-bucket` whose `prompts.installed` is `['Work/AI/summarize', 'tone of voice']`
- **THEN** the result has `version: 5` and `prompts.installed: ['prompts/my-bucket/Work/AI/summarize', 'prompts/my-bucket/tone of voice']`

#### Scenario: A v4 config's already-qualified shared favourite is left untouched

- **WHEN** `migrateConfig` reads a v4 config whose `prompts.installed` contains `'prompts/owner-bucket/Work/AI/summarize'`
- **THEN** the result's `prompts.installed` still contains that exact string, unqualified again

#### Scenario: Favourited prompt ids survive a v5-to-v5 round trip

- **WHEN** `migrateConfig` reads a v5 config whose `prompts.installed` is `['prompts/my-bucket/Work/AI/summarize', 'prompts/owner-bucket/tone of voice']`
- **THEN** both ids are returned in order, unchanged

#### Scenario: Corrupt entries are dropped

- **WHEN** a stored `prompts.installed` contains non-string entries
- **THEN** only the string entries survive

---

### Requirement: `PATCH /api/v1/user-config/prompts` toggles a prompt favourite

The endpoint SHALL accept `UpdateInstalledPromptDto` (`{ id: string; isInstalled: boolean }`) and respond `204`. It SHALL add `id` to `prompts.installed` when `isInstalled` is `true`, remove it when `false`, and leave every other config section untouched.

`id` SHALL be the prompt's full resource path (`prompts/{bucket}/{path}`) and SHALL be validated with the same catalog-resource allowlist the share DTOs use (see `catalog-unshare`), extended to the `prompts/` prefix, rather than the prompts module's bucket-relative `PROMPT_PATH_PATTERN` or the shared `UpdateInstalledDto` rule (`@Matches(/^\S+$/)`, which rejects the spaces a prompt path may legitimately contain). The pattern still rejects `.` / `..` traversal segments and empty segments, and `id` is capped at 2048 characters.

Adding an already-present path SHALL NOT duplicate it; removing an absent path SHALL be a no-op.

#### Scenario: Favouriting a nested prompt whose name contains spaces

- **WHEN** `PATCH /api/v1/user-config/prompts` is called with `{ id: 'prompts/my-bucket/Work/AI/tone of voice', isInstalled: true }`
- **THEN** the response is `204` and the id is appended to `prompts.installed`

#### Scenario: A traversal path is rejected before the service runs

- **WHEN** `PATCH /api/v1/user-config/prompts` is called with an `id` containing a `..` segment
- **THEN** the response is `400` and the config is not modified

#### Scenario: Unfavouriting removes only the given id

- **WHEN** the endpoint is called with `isInstalled: false` for an id currently in `prompts.installed`
- **THEN** that id is removed and `deployments`, `toolsets`, and `conversations` are byte-identical

---

### Requirement: The frontend folds prompt favourites into the single favourites set

`FavoriteEntityType` SHALL gain a `Prompt` member, and `FavoriteApplicationsProvider` SHALL include `config.prompts?.installed` in the `favoriteIds` set it builds, alongside the deployment and toolset lists.

`toggleFavorite` SHALL dispatch to the endpoint matching the entity type through a lookup keyed by `FavoriteEntityType`, and SHALL keep its existing optimistic-update-then-revert-on-failure behaviour for prompts. It SHALL always be called with the prompt's full resource-path `id` — the same `id` `CatalogItem` carries for every prompt, personal or shared — with no bucket-relative fallback.

`resolveFavoriteEntityType` (`apps/chat/src/utils/favorites.ts`) SHALL map a `CatalogEntityType` to the section its favourite is stored in, defaulting to `Deployment` for an unknown or absent type.

#### Scenario: Favourite ids include prompts on load

- **WHEN** the provider loads a user config whose `prompts.installed` contains `prompts/my-bucket/Work/AI/summarize`
- **THEN** `favoriteIds.has('prompts/my-bucket/Work/AI/summarize')` is `true`

#### Scenario: A prompt toggle hits only the prompts endpoint

- **WHEN** `toggleFavorite('prompts/my-bucket/Work/AI/summarize', true, FavoriteEntityType.Prompt)` is called
- **THEN** `updateInstalledPrompt('prompts/my-bucket/Work/AI/summarize', true)` is called and neither `updateInstalledDeployment` nor `updateInstalledToolset` is

#### Scenario: A failed prompt toggle reverts the optimistic update

- **WHEN** `updateInstalledPrompt` rejects
- **THEN** the id is removed from `favoriteIds` again and the error is re-thrown to the caller
