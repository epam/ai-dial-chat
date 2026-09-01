# Spec: catalog-create-app

## Purpose

Defines the catalog's create menu: which options it offers, what gates each one, and where each navigates — including the Quick App option's application-schema resolution and its hand-off into the `/apps-editor` authoring flow.

## Requirements

### Requirement: The catalog create menu offers one option per authorable entity, each behind its own gate

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL build a `createOptions` array of `DropdownItem` entries, appended in a fixed order, each guarded by its own condition:

| Order | Key | Label key | Gate | Destination |
|---|---|---|---|---|
| 1 | `quick-app` | `CatalogI18nKeys.CreateQuickApp` | a Quick App schema resolved **and** `OverlayFeature.CustomApplications` on **and** `OverlayFeature.HideCustomAppCreation` off | `/apps-editor`, via `buildEditorUrl` |
| 2 | `toolset` | `CatalogI18nKeys.CreateToolset` | `OverlayFeature.Toolsets` on | `ROUTES.ToolsetEditor` |
| 3 | `custom-app` | `CatalogI18nKeys.CreateCustomApp` | `OverlayFeature.CustomApps` on **and** `OverlayFeature.HideCustomAppCreation` off | `ROUTES.CustomAppEditor` |
| 4 | `skill` | `CatalogI18nKeys.CreateSkill` | always appended | submenu, see below |
| 5 | `prompt` | `CatalogI18nKeys.CreatePrompt` | `OverlayFeature.Prompts` on | `ROUTES.PromptEditor` |

Only the Quick App option routes into `/apps-editor`. Toolsets, custom apps, skills, and prompts each have their own editor route and are **not** schema-driven — no application schema is looked up for them.

The `skill` entry SHALL be a submenu rather than a direct action, with two children: `skill-write-instructions`, navigating to `ROUTES.SkillEditor`, and `skill-upload`, which opens the skill-archive file picker instead of navigating.

Every navigating option other than Quick App SHALL carry only a return-url query parameter pointing back at `ROUTES.Catalog`, so the editor knows where to send the user on cancel.

**Feature flags**: four `OverlayFeature` toggles gate this menu — `CustomApplications`, `HideCustomAppCreation`, `Toolsets`, `CustomApps` — plus `Prompts` for the prompt entry. `HideCustomAppCreation` is an inverted gate: when on, it removes both the Quick App and the custom-app options.

**i18n impact**: all labels come from existing `CatalogI18nKeys` members. No new keys.

**RTL / UI impact**: none — delegated to `@epam/ai-dial-catalog`'s `CreateButton`.

**Memoisation**: `createOptions` SHALL be wrapped in `useMemo` over the schema id, the navigate function, `buildEditorUrl`, the archive-picker trigger, `t`, and every gating flag it reads.

**Accessibility**: `CreateButton` from `@epam/ai-dial-catalog` handles its own ARIA. No additional attributes are required in `CatalogView`.

#### Scenario: A disabled feature removes only its own option

- **WHEN** `OverlayFeature.Toolsets` is off and every other gate passes
- **THEN** `createOptions` contains no `toolset` entry and every other entry is unaffected

#### Scenario: HideCustomAppCreation removes two options at once

- **WHEN** `OverlayFeature.HideCustomAppCreation` is on
- **THEN** neither the `quick-app` nor the `custom-app` entry is present, regardless of the `CustomApplications` and `CustomApps` flags

#### Scenario: The skill option is always offered

- **WHEN** the create menu is built with every other gate off
- **THEN** the `skill` entry is still present, with its two children

#### Scenario: Uploading a skill archive does not navigate

- **WHEN** the user activates the `skill-upload` child
- **THEN** the skill-archive file picker opens and no navigation occurs

#### Scenario: Non-Quick-App editors receive only a return url

- **WHEN** the user activates the `toolset`, `custom-app`, `skill-write-instructions`, or `prompt` entry
- **THEN** the router navigates to that entry's own editor route with a single return-url parameter pointing at the catalog

---

### Requirement: The Quick App option resolves its schema and navigates through a shared editor-URL builder

The Quick App entry SHALL resolve its schema id once, memoised on `useDeployments().schemas`, as `schemas.find((s) => isQuickAppSchema(s))?.id` — using the shared `isQuickAppSchema` helper *(TODO: it matches on schema id suffix / display name because DIAL Core does not yet expose a stable capability/type field — replace with a proper identifier once one is available)*. When no schema matches, `quickAppSchemaId` is `undefined` and the option SHALL be omitted, so the option is absent while schemas are still loading and appears once they arrive.

The same resolved id also drives the catalog's Quick App **edit** action, which is why it is computed at component scope rather than inside the create-menu memo.

Navigation SHALL go through the shared `buildEditorUrl({ schemaId, step, appId?, isCreating? })` callback rather than a hand-written query string, so create and edit cannot drift apart. For the create option it is called with the resolved schema id, `AppsEditorStep.General`, and `isCreating: true`, producing:

```
/apps-editor?step=general&schema=<encoded schemaId>&returnUrl=%2Fcatalog&isCreating=1
```

`buildEditorUrl` SHALL always set the step, schema, and return-url parameters, and SHALL add `appId` and `isCreating` only when supplied. The schema id is passed whole, with no stripping — the editor stores it as-is in the URL and looks it up in `schemas` on mount. `URLSearchParams` does the encoding.

#### Scenario: Quick App option present when a schema matches

- **WHEN** `useDeployments().schemas` contains an entry for which `isQuickAppSchema` returns true, and both custom-application gates pass
- **THEN** `createOptions` includes an entry labelled `t(CatalogI18nKeys.CreateQuickApp)`

#### Scenario: Clicking Create Quick App navigates to apps-editor

- **WHEN** the user activates the Quick App option
- **THEN** the router navigates to `/apps-editor` with `step=general`, the resolved schema id, `returnUrl` pointing at the catalog, and `isCreating=1`

#### Scenario: Quick App option hidden when no schema matches

- **WHEN** no entry in `useDeployments().schemas` satisfies `isQuickAppSchema`
- **THEN** `createOptions` includes no Quick App entry

#### Scenario: Quick App option hidden while schemas are still loading

- **WHEN** `schemas` is still empty
- **THEN** `quickAppSchemaId` is `undefined` and no Quick App entry is offered

#### Scenario: The edit action reuses the same builder

- **WHEN** the catalog opens an existing Quick App for editing
- **THEN** it calls the same `buildEditorUrl` with `AppsEditorStep.Settings`, supplying `appId` and omitting `isCreating`
