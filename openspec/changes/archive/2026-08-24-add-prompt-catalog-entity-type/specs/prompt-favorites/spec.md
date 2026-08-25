# Spec: Prompt favourites

## ADDED Requirements

### Requirement: User config carries a prompts favourites section

`UserConfig` (`apps/chat-api/src/user-config/dto/user-config.dto.ts`) SHALL gain a `prompts: PromptsConfig` section holding `installed: string[]` — the DIAL paths of the prompts the user has favourited. `PromptsConfigDto` SHALL expose it through Swagger so the generated client types it.

`CURRENT_CONFIG_VERSION` SHALL become `4`, and `migrateConfig` SHALL populate `prompts.installed` for every earlier stored shape:

- absent or non-object input → `[]`
- v1 flat shape (`pinnedConversationIds` at the root) → `[]`
- v2 / v3 shape without a `prompts` key → `[]`
- v4 shape → the stored array, with non-string entries dropped

`DEFAULT_USER_CONFIG` MUST NOT be handed out directly, because the service mutates the installed and pinned arrays in place. `createDefaultUserConfig()` SHALL return a fresh copy, and every default-config path in `UserConfigService` SHALL use it.

#### Scenario: A v3 config gains an empty prompts section

- **WHEN** `migrateConfig` reads a stored v3 config with no `prompts` key
- **THEN** the result has `version: 4` and `prompts: { installed: [] }`
- **AND** `conversations.pinnedIds`, `toolsets.installed`, and `deployments` are preserved unchanged

#### Scenario: Favourited prompt paths survive a round trip

- **WHEN** `migrateConfig` reads a v4 config whose `prompts.installed` is `['Work/AI/summarize', 'tone of voice']`
- **THEN** both paths are returned in order

#### Scenario: Corrupt entries are dropped

- **WHEN** a stored `prompts.installed` contains non-string entries
- **THEN** only the string entries survive

---

### Requirement: `PATCH /api/v1/user-config/prompts` toggles a prompt favourite

The endpoint SHALL accept `UpdateInstalledPromptDto` (`{ id: string; isInstalled: boolean }`) and respond `204`. It SHALL add `id` to `prompts.installed` when `isInstalled` is `true`, remove it when `false`, and leave every other config section untouched.

`id` SHALL be validated against the prompts module's `PROMPT_PATH_PATTERN` rather than the shared `UpdateInstalledDto` rule: a prompt path legitimately contains spaces and slashes, which `@Matches(/^\S+$/)` rejects. The pattern still rejects `.` / `..` traversal segments and empty segments, and `id` is capped at 2048 characters.

Adding an already-present path SHALL NOT duplicate it; removing an absent path SHALL be a no-op.

#### Scenario: Favouriting a nested prompt whose name contains spaces

- **WHEN** `PATCH /api/v1/user-config/prompts` is called with `{ id: 'Work/AI/tone of voice', isInstalled: true }`
- **THEN** the response is `204` and the path is appended to `prompts.installed`

#### Scenario: A traversal path is rejected before the service runs

- **WHEN** the body's `id` is `../other-bucket/secret`
- **THEN** the response is `400` and no config write is attempted

#### Scenario: Unfavouriting removes only the given path

- **WHEN** the endpoint is called with `isInstalled: false` for a path currently in `prompts.installed`
- **THEN** that path is removed and `deployments`, `toolsets`, and `conversations` are byte-identical

---

### Requirement: The frontend folds prompt favourites into the single favourites set

`FavoriteEntityType` SHALL gain a `Prompt` member, and `FavoriteApplicationsProvider` SHALL include `config.prompts?.installed` in the `favoriteIds` set it builds, alongside the deployment and toolset lists.

`toggleFavorite` SHALL dispatch to the endpoint matching the entity type through a lookup keyed by `FavoriteEntityType`, and SHALL keep its existing optimistic-update-then-revert-on-failure behaviour for prompts.

`resolveFavoriteEntityType` (`apps/chat/src/utils/favorites.ts`) SHALL map a `CatalogEntityType` to the section its favourite is stored in, defaulting to `Deployment` for an unknown or absent type.

#### Scenario: Favourite ids include prompts on load

- **WHEN** the provider loads a user config whose `prompts.installed` contains `Work/AI/summarize`
- **THEN** `favoriteIds.has('Work/AI/summarize')` is `true`

#### Scenario: A prompt toggle hits only the prompts endpoint

- **WHEN** `toggleFavorite(path, true, FavoriteEntityType.Prompt)` is called
- **THEN** `updateInstalledPrompt(path, true)` is called and neither `updateInstalledDeployment` nor `updateInstalledToolset` is

#### Scenario: A failed prompt toggle reverts the optimistic update

- **WHEN** `updateInstalledPrompt` rejects
- **THEN** the path is removed from `favoriteIds` again and the error is re-thrown to the caller
