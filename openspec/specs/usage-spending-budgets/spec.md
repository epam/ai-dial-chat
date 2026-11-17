# usage-spending-budgets Specification

## Purpose

Shows the caller's DIAL Core spending budgets on the Usage page. An operator-set mode, which mirrors
DIAL Core's `spendingLimits.mode`, decides how budgets and the legacy role cost limit are presented
on the Usage page, in the composer usage banner and in the usage dial.

## Requirements

### Requirement: Spending limits mode operator setting

`chat-api` SHALL accept an optional environment variable `SPENDING_LIMITS_MODE` with the values `off`,
`shadow` and `enforce`, defaulting to `off`. Any other value SHALL fail environment validation at
boot. The value SHALL reach the client as `config.spendingLimitsMode` on `GET /api/v1/client-config`,
and SHALL also be settable through managed config.

#### Scenario: Default mode

- **WHEN** `SPENDING_LIMITS_MODE` is not set and no managed value exists
- **THEN** `GET /api/v1/client-config` returns `"config": { "spendingLimitsMode": "off" }`

#### Scenario: Configured mode

- **WHEN** `SPENDING_LIMITS_MODE=enforce`
- **THEN** `config.spendingLimitsMode` is `"enforce"`

#### Scenario: Invalid value fails boot

- **WHEN** `SPENDING_LIMITS_MODE` is `ENFORCE `, `on` or `true`
- **THEN** environment validation rejects it and the service does not start

#### Scenario: Managed value applies when the environment is unset

- **WHEN** `SPENDING_LIMITS_MODE` is not set and the published managed config sets `usageLimits.spendingLimitsMode` to `enforce`
- **THEN** `config.spendingLimitsMode` is `"enforce"`

#### Scenario: Explicit environment value wins over managed config

- **WHEN** `SPENDING_LIMITS_MODE=shadow` and the published managed config sets `enforce`
- **THEN** `config.spendingLimitsMode` is `"shadow"`, following the existing provider order (environment, then managed, then default)

### Requirement: Spending limits mode registry entry

The config registry SHALL declare the key `usageLimits.spendingLimitsMode` with `type: 'config'`,
`visibility: 'client'`, `defaultValue: 'off'` and `envVar: 'SPENDING_LIMITS_MODE'`, and a managed
schema that enumerates `off`, `shadow` and `enforce`. Adding the key SHALL be a MINOR bump of the
managed-config schema version, with the artifact regenerated and pinned.

#### Scenario: Managed schema enumerates the modes

- **WHEN** the managed-config schema artifact is generated
- **THEN** it contains `usageLimits.spendingLimitsMode` as a string with `enum: ["off", "shadow", "enforce"]`, and every payload valid under the previous version still validates

### Requirement: Spending limits mode client config field

`ClientConfigDto` SHALL gain a required `spendingLimitsMode` property, a string enum named
`SpendingLimitsMode`, and the mapper SHALL fall back to `off` for any value outside it.
`GET /api/v1/client-config` keeps operationId `getClientConfig`, and the OpenAPI document and
generated client are regenerated. Example fragment: `{ "config": { "spendingLimitsMode": "shadow" } }`.

#### Scenario: Generated client types the field

- **WHEN** a consumer reads `getClientConfig()`'s result
- **THEN** `config.spendingLimitsMode` is typed as the generated `SpendingLimitsMode` union of the three values

#### Scenario: Unknown resolved value falls back

- **WHEN** a managed value outside `off`/`shadow`/`enforce` reaches the mapper
- **THEN** `config.spendingLimitsMode` is `"off"` and a warning is logged

#### Scenario: AppConfigContext default before load

- **WHEN** `AppConfigContext` has not yet received the client config, or the response omits `spendingLimitsMode`
- **THEN** `useAppConfig().config.spendingLimitsMode` is `off`

### Requirement: Effective spending limits mode

The chat SHALL present budgets according to an effective mode. The effective mode is the configured
mode when the usage response carries both a `budgets` array and a non-empty `costObject`, and `off`
otherwise. The resolution SHALL be a pure function of the configured mode and the response. It lives
in `libs/chat-hooks/src/usage` and reads no config or context itself.

#### Scenario: Core reports budgets

- **WHEN** the configured mode is `enforce` and the response has `costObject: "ORG"` and `budgets: [...]`
- **THEN** the effective mode is `enforce`

#### Scenario: Core has spending limits off

- **WHEN** the configured mode is `enforce` and the response has `budgets: []` and no `costObject`
- **THEN** the effective mode is `off`

#### Scenario: Older Core without budgets

- **WHEN** the configured mode is `shadow` and the response has no `budgets` key
- **THEN** the effective mode is `off`

#### Scenario: Configured off ignores budgets

- **WHEN** the configured mode is `off` and the response carries `costObject` and budgets
- **THEN** the effective mode is `off`, and no budget is rendered anywhere

#### Scenario: Usage not loaded yet

- **WHEN** the usage response is `undefined`
- **THEN** the effective mode is `off`

### Requirement: Charged budgets

The Usage page SHALL list only the budgets charged for the caller's model calls: the entries of
`budgets` whose `costObject` equals the response's top-level `costObject`. It SHALL keep DIAL Core's
order, which is the priority order in which a model call picks its payer, and SHALL NOT re-sort,
merge or de-duplicate entries.

#### Scenario: Budgets of another cost object are left out

- **WHEN** `costObject` is `"ORG"` and `budgets` has entries for `"ORG"`, `"project-a"` and `"ORG"`, in that order
- **THEN** the budgets section lists the two `"ORG"` entries in their response order, and nothing from `"project-a"`

#### Scenario: Same policy twice

- **WHEN** two charged entries share a `policy`
- **THEN** both are listed, each with a distinct stable key

### Requirement: Budget item cards

Each listed budget SHALL show a Today card built from `day` and a This month card built from
`month`, with the same status, sentinel, reset-time and formatting rules as the aggregate period
cost cards (`usage-model-limits`). Budgets have no week card.

#### Scenario: Two cards per budget

- **WHEN** a charged budget is listed
- **THEN** it shows exactly a Today card and a This month card, in that order

### Requirement: Budget item title

A budget's title SHALL be its `displayName` when that is non-blank, and its `policy` otherwise.

#### Scenario: Display name used

- **WHEN** a budget has `displayName: "Organization-wide"`
- **THEN** its title is `Organization-wide`

#### Scenario: Display name fallback

- **WHEN** a budget has `displayName: "  "` and `policy: "policies/team"`
- **THEN** its title is `policies/team`

### Requirement: Budget item model coverage

A budget with `object: "*"` SHALL show `usage.budgets.allModels` ("All models"). A budget with a
list SHALL show `usage.budgets.coveredModels` (`Models: {{models}}`), with each id resolved to its
localized deployment display name and an unknown id shown as is. A budget without `object` SHALL
show no coverage line.

#### Scenario: All models

- **WHEN** a budget has `object: "*"`
- **THEN** its coverage line reads `All models`

#### Scenario: Unlimited day window

- **WHEN** a budget's `day.total` is `9223372036854775807` and `month.total` is `200`
- **THEN** the Today card shows the spend only (`isUnlimited`), and the This month card shows used of the `formatCost`-formatted 200, a progress bar, the remaining amount and a status badge

#### Scenario: Model list coverage

- **WHEN** `object` is `["gpt-4o", "unknown-model"]` and only `gpt-4o` is a known deployment with display name `GPT-4o`
- **THEN** the coverage line reads `Models: GPT-4o, unknown-model`

#### Scenario: Over-budget window

- **WHEN** a budget's `month.used` is `210` and `month.total` is `200`
- **THEN** the This month card has status `LimitReached` and an unclamped used percent of 105

### Requirement: Usage page in off mode

When the effective mode is `off`, `UsageTab` (`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`)
SHALL render exactly as before this change, and SHALL render no budget.

#### Scenario: Off renders today's page

- **WHEN** the effective mode is `off`
- **THEN** the Usage page DOM is the same as before this change for the same response

### Requirement: Usage page in shadow mode

When the effective mode is `shadow`, the page SHALL keep the aggregate cards, the Overall Cost
header indicators and the model limits table as today, and SHALL add the budgets section between
the aggregate cards and the model limits table, with the notice `usage.budgets.shadowNotice`.

#### Scenario: Shadow adds the section

- **WHEN** the effective mode is `shadow` and one budget is charged
- **THEN** the page shows the aggregate cards, then the budgets section with the not-enforced notice, then the model limits table

### Requirement: Usage page in enforce mode

When the effective mode is `enforce`, the cost part of the page SHALL be the budgets section only:
no legacy aggregate card SHALL render, whatever the top-level `*CostStats` carry. The Overall Cost
header indicators SHALL show no legacy cost status, and the model limits table SHALL render after
the budgets section.

#### Scenario: Enforce with a finite role limit

- **WHEN** the effective mode is `enforce` and `monthCostStats.total` is `100`
- **THEN** the page shows the budgets section and the model limits table, and no aggregate cost card

#### Scenario: Enforce with unlimited role limit

- **WHEN** the effective mode is `enforce` and every top-level `*CostStats` total is the sentinel
- **THEN** no aggregate cost card is rendered, and no Overall Cost header shows a running-low or limit-reached indicator

### Requirement: Budgets section states

In `enforce`, an empty charged list SHALL render the empty state `usage.budgets.enforceEmpty`, which
says that model requests are rejected until a budget is assigned. In `shadow`, an empty charged list
SHALL render no section. While usage loads, the page keeps its existing spinner. On a fetch error,
the existing error notification applies and no section is rendered.

#### Scenario: Enforce without a charged budget

- **WHEN** the effective mode is `enforce` and no budget matches `costObject`
- **THEN** the budgets section renders its heading and the `usage.budgets.enforceEmpty` text, and no card

#### Scenario: Shadow without a charged budget

- **WHEN** the effective mode is `shadow` and no budget matches `costObject`
- **THEN** no budgets section is rendered

### Requirement: Legacy account cost is withheld in enforce

When the effective mode is `enforce`, the composer usage banner, the usage dial popover, the
Overall Cost header indicators and the Overall Cost status folded into each model row SHALL NOT
read the top-level `dayCostStats`/`weekCostStats`/`monthCostStats`.
One pure `libs/chat-hooks` helper removes them when the data is mapped, not fetched, so a mode
change needs no re-fetch. Token and per-deployment stats are kept; `off` and `shadow` map the data
unchanged.

#### Scenario: Banner ignores the role cost limit in enforce

- **WHEN** the effective mode is `enforce`, `monthCostStats` is 95% used, and every token stat is below the threshold
- **THEN** the composer renders no usage banner

#### Scenario: Banner keeps token limits in enforce

- **WHEN** the effective mode is `enforce` and the selected deployment's `monthTokenStats` is 100% used
- **THEN** the banner shows the reached state for the token limit, as today

#### Scenario: Dial lists no account cost group in enforce

- **WHEN** the effective mode is `enforce` and the usage dial popover opens
- **THEN** it lists no Cost limits group

#### Scenario: Model row status ignores the role cost limit in enforce

- **WHEN** the effective mode is `enforce`, `monthCostStats` is 100% used, and a model row's own token stats are within limits
- **THEN** that row's status is within limits, not limit reached

#### Scenario: Shadow keeps the role cost limit

- **WHEN** the effective mode is `shadow` and `monthCostStats` is 95% used
- **THEN** the banner and the dial behave as they did before this change

### Requirement: Refresh at budget window resets

The Usage page SHALL include every listed budget window's `resetsAt` in the reset boundaries it
already arms a refresh timer for. A boundary that elapses SHALL trigger one re-fetch, and no figure
is zeroed client-side.

#### Scenario: Budget day window resets first

- **WHEN** a charged budget's `day.resetsAt` is earlier than every displayed aggregate card's reset
- **THEN** the page re-fetches usage once, shortly after that instant

### Requirement: Library isolation for budgets

The budget mapping and mode helpers in `libs/chat-hooks` SHALL receive the configured mode, the
translate callback, `formatResetTime` and a model display-name resolver as parameters, and SHALL NOT
import config, context or i18n. `SpendingBudgetsSection` SHALL know nothing about modes. The state
is owned by `UsageTab` (memoised derivations of `useUsageData`'s `usage`) and by `AppConfigContext`
(the mode).

#### Scenario: Mapper is pure

- **WHEN** `mapBudgetsToDashboard` is called twice with the same arguments
- **THEN** it returns deep-equal results, and reads no clock, storage or context

### Requirement: Budgets i18n, gating and observability

Every new string SHALL be a `t()` key in `apps/chat`: `usage.budgets.heading`, `.description`,
`.shadowNotice`, `.enforceEmpty`, `.allModels` and `.coveredModels`. The feature has no `ENABLED_FEATURES` gate: the mode is the gate. It emits no
telemetry and adds no cache.

#### Scenario: Strings are translated

- **WHEN** the Usage page renders in a non-English locale that defines the keys
- **THEN** every budgets heading, notice, empty state and coverage text is in that locale

### Requirement: Budgets accessibility and direction

The budgets UI SHALL meet the repository's WCAG 2.1 AAA rules and SHALL mirror in right-to-left
locales through logical properties.

#### Scenario: Section is a named region

- **WHEN** the budgets section renders
- **THEN** it is a `section` labelled by its `h2` heading, and each budget is a `role="group"` named by its title

#### Scenario: Status change is announced

- **WHEN** the budgets section first renders after loading
- **THEN** the page's existing live region announces the loaded state once, and the section adds no second live region

#### Scenario: RTL layout

- **WHEN** the active language is Arabic
- **THEN** the section, the cards and the coverage line mirror through logical properties, and the section has no directional icon
