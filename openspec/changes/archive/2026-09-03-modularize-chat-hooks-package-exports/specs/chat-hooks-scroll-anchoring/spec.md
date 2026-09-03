## MODIFIED Requirements

### Requirement: Library isolation
`libs/chat-hooks`'s `./scroll-anchoring` entry point (which publishes `useConversationScroll`) SHALL require no runtime `peerDependency` beyond `react` — no consumer that imports only
`@epam/ai-dial-chat-hooks/scroll-anchoring` is required to install any `@epam/ai-dial-*`
package, any REST/API-client module, or any other feature-specific peer. The `libs/chat-hooks`
package as a whole declares many peers, one per feature entry point it also publishes (see
`chat-hooks-package-distribution`); this requirement constrains the `./scroll-anchoring` entry
point specifically, not the package's flat `peerDependencies` list.
`useConversationScroll` itself SHALL NOT import, at runtime or as a type dependency, any
`@epam/ai-dial-*` package, any REST/API-client module, any application context/provider, any
routing, storage, analytics, or i18n module. The hook SHALL accept all chat-domain data and
behavior through function parameters (props/callbacks), never through implicit access to
app-owned singletons or global state.

#### Scenario: Building the `./scroll-anchoring` entry without the host app or other features
- **WHEN** the `./scroll-anchoring` entry point is built in isolation
- **THEN** the build succeeds without resolving `@epam/ai-dial-ui-kit`,
  `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-react-file-manager`,
  any other `@epam/ai-dial-*` package, or any `apps/chat/**` module

#### Scenario: Module boundary lint passes for `useConversationScroll`'s own module graph
- **WHEN** `@nx/enforce-module-boundaries` lints the source files reachable from
  `useConversationScroll`'s implementation
- **THEN** no violation is reported for importing an app, a generated API client, or another
  `@epam/ai-dial-*` library beyond `react`

#### Scenario: Installing only for `./scroll-anchoring` requires only `react`
- **WHEN** a consumer runs `npm install @epam/ai-dial-chat-hooks react` and imports only
  `@epam/ai-dial-chat-hooks/scroll-anchoring`
- **THEN** the install succeeds with no unmet-peer warning, and the consumer's build resolves
  `useConversationScroll` without any other package present
