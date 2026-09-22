# Scheduled Tasks reuse

`@epam/ai-dial-scheduled-tasks` supplies presentation; hosts own routes,
feature gates, i18n, notifications and configured API clients. Import its
`styles.css` once (it includes builder-form structural CSS) and import UI Kit
base/theme styles once at the host root.

## Migration map

| Finding                                              | Public replacement                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F01 form observer / editor placeholder patch         | `ScheduledTaskCreateForm.labels.instructionsPlaceholder`                                                         |
| F02/F10 duplicated form validation                   | `@epam/ai-dial-scheduled-tasks/validation` and checked preparation in `@epam/ai-dial-chat-hooks/scheduled-tasks` |
| F03/F13 local request and retry state                | `useScheduledTasks` / `useScheduledTaskRuns` with an injected configured client                                  |
| F04/F05 local schedule formatter                     | trigger descriptor and host formatter from the hooks entry                                                       |
| F06-F08/F14/F15 private layout/icon/status selectors | documented form, list, detail/history and delete-confirmation props                                              |
| F09 provider-bound model field                       | `DeploymentSelectorField` with host-resolved records and callbacks                                               |
| F11 deep CSS imports                                 | `@epam/ai-dial-scheduled-tasks/styles.css`                                                                       |

The fixture at `tools/scheduled-tasks-consumer-fixture` proves this boundary
against packed artifacts, rather than workspace aliases. It imports scheduler
and catalog public entries only; host adapters provide resolved deployment
records, callbacks, labels, and a configured scheduler client. UI Kit base and
theme styles remain singleton host imports, while the scheduler stylesheet
includes its builder-form structural dependency.

The public APIs are additive. Omitted icons retain defaults; `null` suppresses
only the decorative node. Per-instance `styles` and layout values override
their component CSS variables and theme-token fallbacks without leaking to a
second instance. Hooks expose no feature-key strings: the host keeps feature
and role gating at its application edge and passes `enabled`.

Rollback the scheduled-tasks, builder-form, catalog and chat-hooks package set
together with its adapters. No API data migration is involved.

## Release notes

- Added reusable scheduled-task validation, checked request preparation, request
  lifecycle hooks, trigger descriptions, and host-configurable form, dashboard,
  detail/history, delete-confirmation, and deployment-picker presentation APIs.
- Fixed recurrence-day validation, stale list/history responses, incremental
  retry preservation, trigger formatting independence, edit load states, and
  resolved model-name fallback.
- Changed CSS distribution so the scheduler stylesheet includes its builder-form
  structural dependency and scopes responsive layout against host utility CSS.
