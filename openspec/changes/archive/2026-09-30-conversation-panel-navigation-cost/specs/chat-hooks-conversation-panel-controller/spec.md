## ADDED Requirements

### Requirement: `useConversationPanelItems` keeps item identity for unchanged DTOs and resolves deployments in constant time

`useConversationPanelItems` (`libs/chat-hooks/src/conversation/useConversationPanelItems/useConversationPanelItems.ts`) SHALL resolve each item's deployment through lookup maps built once per `deployments` array reference:

- one map keyed on `id`;
- one map keyed on `reference`, keeping the first deployment for a duplicated reference.

The id map SHALL be consulted first and the reference map only on a miss. This reproduces `findDeploymentByIdOrReference`'s precedence and first-match semantics exactly. The per-item lookup is therefore O(1), and the whole mapping is O(N) instead of O(N × D).

The hook SHALL keep a per-DTO cache. When it recomputes because `items` changed, any DTO object that is referentially identical to one mapped in the previous computation SHALL produce the same `ConversationItem` object as before. This holds only while every other input is referentially unchanged: `deployments`, `isDeploymentsLoading`, `toPanelConversationId`, `resolveIconUrl`, `resolveIconTooltip`, `resolveHref` and `resolveTaskPresentation`. A change to any of those inputs SHALL rebuild every item. The cache SHALL hold entries only for the DTOs of the latest `items`, so it does not grow with list churn.

The mapping output per item is unchanged. So are the existing guarantees: every given item is mapped, no collapsing happens, and the returned array reference is the same when all inputs are unchanged.

The hook remains host-agnostic. Deployments, icon URLs, tooltips, hrefs and task presentation still arrive through the existing parameters, and no import of app code, i18n or network code is added. This adds no user-visible string, feature flag, cache TTL or telemetry.

#### Scenario: An unchanged DTO keeps its item across a list change

- **GIVEN** the hook has mapped `items = [a, b]` into `[A, B]`
- **WHEN** it is called with `items = [a, c]`, where `a` is the same object, and all other inputs are unchanged
- **THEN** the first returned item is the same object `A`, and the second is a new object mapped from `c`

#### Scenario: Changing a resolver rebuilds every item

- **GIVEN** the hook has mapped `items = [a]` into `[A]`
- **WHEN** it is called with the same `items` and a new `resolveHref` function
- **THEN** the returned item is a new object whose `href` comes from the new resolver

#### Scenario: Id match wins over reference match

- **GIVEN** deployment `X` with `id: "m1"` and deployment `Y` with `reference: "m1"`
- **WHEN** an item whose model id is `m1` is mapped
- **THEN** its icon and tooltip resolve from `X`

#### Scenario: Reference match is used when no id matches

- **GIVEN** a deployment with `id: "gpt-4o-2024"` and `reference: "gpt-4o"`, and no deployment with `id: "gpt-4o"`
- **WHEN** an item whose model id is `gpt-4o` is mapped
- **THEN** its icon and tooltip resolve from that deployment
