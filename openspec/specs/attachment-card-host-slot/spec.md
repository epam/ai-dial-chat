# Spec: attachment-card-host-slot

## Purpose

Lets a host application replace the card that represents a single attachment with its own component, once, for every list in the shared libs, without those libs knowing which host asks. The built-in square tile stays the default.

---

## Requirements

### Requirement: `@epam/ai-dial-attachment-input` exports `AttachmentCardProvider`

`libs/attachment-input/src/index.ts` SHALL export the component `AttachmentCardProvider` and its props type `AttachmentCardProviderProps`. `AttachmentCardProviderProps` SHALL declare:

- `component?: ComponentType<AttachmentCardProps>`: the component rendered in place of the built-in tile by every `AttachmentCard` below the provider. When omitted, the built-in tile is used.
- `children?: ReactNode`: the subtree whose attachment cards use `component`.

The provider owns no state, renders no element of its own and takes no other props. The context it provides is read only by `AttachmentCard`.

#### Scenario: Provider and its props type are public

- **WHEN** a host imports `AttachmentCardProvider` and `AttachmentCardProviderProps` from `@epam/ai-dial-attachment-input`
- **THEN** both resolve and `component` accepts a component typed `FC<AttachmentCardProps>`

#### Scenario: Provider adds no markup

- **WHEN** `AttachmentCardProvider` wraps a subtree
- **THEN** the DOM of the subtree is identical to the DOM without the provider

### Requirement: `AttachmentCard` renders the host's component when a provider supplies one

`AttachmentCard` SHALL render the `component` of the nearest `AttachmentCardProvider` with every prop it received, unchanged (`attachment`, `searchQuery`, `onRemove`, `onRetry`, `onExpand`, `onClick`, `onDownload`, `labels`, `styles`, `isSelected`). It SHALL NOT wrap the host's component in an element, add a role, a class name or an attribute, or take over any of its behaviour: states, actions, sizing and accessibility of the card are the host component's. Neither the host component nor the built-in tile renders while the other does.

#### Scenario: Host component replaces the tile

- **WHEN** `AttachmentCard` is rendered inside `<AttachmentCardProvider component={HostCard}>`
- **THEN** `HostCard` renders and the built-in tile does not

#### Scenario: Every prop is forwarded

- **WHEN** `AttachmentCard` is rendered inside a provider with `isSelected` and an `attachment`
- **THEN** `HostCard` receives the same `attachment` and `isSelected` values

#### Scenario: No wrapper around the host component

- **WHEN** `AttachmentCard` renders the host component
- **THEN** the card's DOM contains only what the host component renders

### Requirement: Without a provider component `AttachmentCard` renders the built-in tile unchanged

When no `AttachmentCardProvider` is mounted, or the nearest one has no `component`, `AttachmentCard` SHALL render the built-in tile (image, file, link, pasted-text and audio variants) with exactly the DOM, class names, behaviour and accessibility it had before the provider existed.

#### Scenario: No provider

- **WHEN** `AttachmentCard` is rendered with no provider above it
- **THEN** the built-in tile renders

#### Scenario: Provider without a component

- **WHEN** `AttachmentCard` is rendered inside `<AttachmentCardProvider>` with no `component`
- **THEN** the built-in tile renders

#### Scenario: Existing behaviour is untouched

- **WHEN** the existing `AttachmentCard`, `AttachmentGroup` and `AttachmentTray` suites run without a provider
- **THEN** they pass without modification

### Requirement: One provider replaces the card in every list of every shared lib

A provider SHALL affect every `AttachmentCard` rendered below it, wherever it is rendered, including by `AttachmentTray`, `AttachmentGroup` and by the other shared libs that render attachment cards (`projects`, `source-panel`, `conversation-stages` and `conversation-messages` through `AttachmentGroup`). A host SHALL need to mount the provider once to change all of them; none of those libs SHALL gain a prop, import or branch that refers to the host.

#### Scenario: Tray and group use the host card

- **WHEN** `AttachmentTray` and `AttachmentGroup` are rendered inside one provider
- **THEN** every card in both is the host's component

#### Scenario: Provider scoped to a subtree

- **WHEN** a provider wraps only one page of a host application
- **THEN** cards rendered outside it keep the built-in tile

### Requirement: A nested provider overrides the outer one

The nearest `AttachmentCardProvider` SHALL decide the card. A nested provider with a `component` SHALL replace the outer one; a nested provider without `component` SHALL restore the built-in tile for its subtree.

#### Scenario: Nested provider without a component

- **WHEN** `<AttachmentCardProvider component={HostCard}>` contains `<AttachmentCardProvider>` with no `component`, which contains an `AttachmentCard`
- **THEN** the built-in tile renders

#### Scenario: Nested provider with another component

- **WHEN** an inner provider supplies `OtherCard` inside an outer provider that supplies `HostCard`
- **THEN** cards in the inner subtree render `OtherCard` and cards outside it render `HostCard`

### Requirement: The host component is a stable reference

Because `AttachmentCard` renders the supplied component as a React element type, a host SHALL pass the same component reference across renders (a module-level or memoised component). The README of `@epam/ai-dial-attachment-input` SHALL state this, and that every package rendering an attachment card must resolve to the same installed copy of `@epam/ai-dial-attachment-input` as the host, otherwise a provider mounted by the host does not reach them.

#### Scenario: Documented constraints

- **WHEN** the README of `@epam/ai-dial-attachment-input` is read
- **THEN** it documents `AttachmentCardProvider`, the single-copy requirement and a usage example that compiles against the public API

### Requirement: Cross-cutting constraints of the slot

The slot SHALL satisfy all of the following:

- **State owner:** the slot is a lib-local React context in `libs/attachment-input`; `apps/chat` adds no context or provider for it.
- **Host knowledge:** the host passes its card as `component`; the lib holds no knowledge of any host, route, feature flag or backend.
- **i18n:** none. No user-visible string is introduced; a host card reads the `labels` it is given.
- **RTL and direction:** the slot adds no markup or class names, so it is direction-agnostic; a host card is responsible for its own logical properties.
- **Accessibility:** owned by the host component (role, name, focus, live-region for errors); the lib neither adds nor removes any.
- **Feature flags, endpoints, caching and telemetry:** none.
- **Memoisation:** the provider passes the supplied component reference unchanged; it creates no per-render objects.

#### Scenario: No host-owned detail in the lib

- **WHEN** `libs/attachment-input` is reviewed after the change
- **THEN** it contains no import of an app context, route, feature flag, auth or storage access introduced by the slot
