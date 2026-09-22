## Why

Scheduled tasks are reusable as components but not yet as a reliable feature: independent consuming applications must manipulate editor DOM, replace SVG paths through CSS, target private class names, and duplicate validation and asynchronous state. The September 22, 2026 review also reproduced invalid weekly/monthly serialization, stale pagination responses, and schedule labels coupled to unrelated task metadata.

## Problem

The parent application's safeguards are not consistently part of the published contract. A consumer cannot reproduce the agreed design using documented package exports alone. Evidence and applicability to each repository are catalogued in design.md; findings in consuming applications are not asserted to be defects in the parent where protections already exist.

## What Changes

- Publish common field validation and trigger-only schedule descriptions.
- Publish scheduler API composition and cancellable list/history hooks from chat-hooks.
- Extend scheduled-tasks with explicit placeholder, icon, card-style and layout contracts; forward nested options through page-level components.
- Extract a controlled, host-independent deployment picker presentation into catalog, retaining app adapters and the opaque modelSelector slot.
- Make the scheduled-tasks stylesheet entry provide its internal structural dependencies and isolate responsive styles from host Tailwind.
- Preserve concrete dashboard, details, history, form and deletion presentation through supported APIs.
- Migrate the parent app, consolidate its form labels, document adoption by external applications, and verify built packages in an external consumer fixture.

## Solution

Use additive contracts in existing packages, followed by parent-app adoption and package-level acceptance tests. No new global context or package is needed. Local controlled values remain host-owned; hooks own request lifetimes; presentation components own only transient UI state.

### Alternatives considered

| Option | Correctness and cost | Isolation/performance | Migration/rollback |
| --- | --- | --- | --- |
| Keep app patches and copy parent utilities | Low immediate cost; consumers continue diverging and depend on private markup | DOM observation and style collisions remain | Easy local rollback, repeated repair on upgrades |
| Add supported contracts to existing packages (selected) | Moderate, testable slices; fixes shared causes | Keeps transport/auth at app edge; removes observers | Optional props, compatible adapters, coherent package rollback |
| Move entire routed feature into one package | Large rewrite and broad delivery risk | Pulls navigation, providers and auth into feature boundary | Harder adoption and rollback |

The second option meets reuse requirements without introducing a second application framework.

## Capabilities

### New Capabilities

- `scheduled-tasks-reuse-contract`: shared validation, trigger descriptions, scheduler client/hooks, stylesheet distribution, external-consumer acceptance and migration contracts.

### Modified Capabilities

- `scheduled-task-create-form`: editor customization and use of common validation.
- `scheduled-tasks-page-ui`: supported grid/card/status/icon customization and incremental error presentation.
- `scheduled-task-detail-page`: layout/history customization, metadata and load-state handling, reusable deletion presentation.
- `deployment-selector-form-trigger`: exported controlled presentation with width/overlay contracts and app adapter compatibility.
- `builder-form`: back-icon customization forwarded through its shell.

## Non-goals

- New scheduler endpoints, DTO schema changes, timezone/DST policy changes, skill selection, or scheduler execution changes.
- Changes to offline-credentials login, unread tracking, run navigation, returnUrl validation, mobile tabs, or role-based feature policy.
- Moving translations, routing, notifications, API configuration or application contexts into UI libraries.
- Publishing packages, updating external application production code, or editing unrelated features during specification preparation. Implementation produces publishable artifacts and an adoption guide; registry release remains the normal release process.

## Acceptance criteria

1. A consumer renders list/create/edit/details/delete and a model picker using public exports, documented CSS and host adapters, with no MutationObserver, private CSS selectors, hidden SVG paths or relative node_modules stylesheet imports.
2. Missing/invalid schedule fields never produce a different frequency or a write request; create and edit share validation.
3. Old pages cannot alter a new query/task, including after abort is ignored; incremental failures preserve existing results and retry the failed page.
4. Schedule descriptions depend only on trigger data; network, not-found and unsupported-edit states are distinct.
5. Visual settings are configurable and per-instance; documented consumer presentation is reproducible. Existing parent mobile tabs and chat picker behavior remain intact.
6. Built-package fixture tests cover public import/type resolution and the documented package/CSS contract.
7. Parent consumers are migrated, public contracts documented, and review findings traced to requirements and automated verification.

## Impact

Affected packages: scheduled-tasks, builder-form, catalog and chat-hooks. Affected app surfaces: scheduled-task pages, their hooks/API adapters, deployment selector adapters and translations. This deliberately crosses shared-library boundaries but adds no global provider, endpoint, cache, role, telemetry event or storage schema.

The parent app supplies configured clients, deployment display records, translated strings, feature enablement and callbacks. UI packages never import generated clients; chat-hooks uses only the existing narrow configured-client exception in AGENTS.md.

New labels/error messages are host-translated; existing translation keys are reused where semantics match. Exact proposed additions appear in design.md.

## Compatibility and rollback

New props are optional with documented defaults. Existing form values, callbacks, modelSelector, theme options and API DTOs stay compatible. Existing isActive callers retain their meaning; an explicit presentation status takes precedence only when supplied. Parent app wrappers preserve existing exports during migration.

No database migration is involved. Roll back consumers and the coherent package version set together. Do not remove legacy exports or require a breaking release in this change; design.md records the behavior corrections and CSS changes that still require release notes.
