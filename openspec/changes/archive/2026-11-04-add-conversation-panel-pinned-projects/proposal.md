## Why

`ConversationList` and `ConversationListSection` render host-supplied pinned project trees through `pinnedProjects`, but `ConversationPanel` — the lib's root component with the header, New chat button, search and filter chips — does not accept the prop. A host built on `ConversationPanel` cannot show pinned projects in its sidebar without giving up the panel chrome and rebuilding it, which `libs/conversation-panel` cannot support: `FilterTabs` and `NewChatButton` are not exported and the package `exports` map forbids deep imports. `ConversationPanel` also builds its list labels from a fixed subset of fields, so `labels.seeAllLabel` and `labels.seeAllAriaLabel`, which `ConversationPanelLabels` already inherits from `ConversationListLabels`, never reach the list.

## What Changes

- `ConversationPanelProps` gains an optional `pinnedProjects?: PinnedProjects`, documented like the same prop on `ConversationList` (`libs/conversation-panel/src/models/panel-props.ts`).
- `ConversationPanel` forwards `pinnedProjects` to its inner `ConversationList` unchanged (`libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx`), following how `ConversationListSection` already forwards it (`libs/conversation-panel/src/components/ConversationListSection/ConversationListSection.tsx`).
- `ConversationPanel` forwards `labels.seeAllLabel` and `labels.seeAllAriaLabel` to the list, inside the existing memoized `listLabels` object, so the See all row of a pinned project can be translated through the panel.
- The panel's own search text and active filter tab already reach the list as controlled props, so project filtering (name and chat title search, Origin filter, `hiddenSources`) needs no new panel logic.
- `libs/conversation-panel/README.md` documents `pinnedProjects` and the See all labels for `ConversationPanel`.
- No behaviour change when `pinnedProjects` is omitted. Nothing is **BREAKING**.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-history-panel`: adds a requirement that `ConversationPanel` accepts `pinnedProjects`, forwards it and the See all labels to its list, and so shows project trees under the panel's own search and filters. The existing requirement "The Pinned section renders host-supplied project trees" is unchanged: rendering, search, filters, drag and drop and accessibility rules stay defined there.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. Forward the prop and the See all labels in `ConversationPanel`** | **Chosen.** Two forwarded fields, no new rendering code, one owner for the rows. |
| B. Each host keeps its own copy of the panel built from `SidebarPanel` and `ConversationList` | Rejected. The host must rebuild the New chat button and filter chips, then keep them in step with every lib style and accessibility change. |
| C. Export `FilterTabs` and `NewChatButton` so hosts can compose the panel | Rejected. It widens the public API and makes every host own the panel's layout, to avoid a one-prop forward. |
| D. Do nothing; hosts migrate to `ConversationListSection` | Rejected as the only path: it is a valid choice for new hosts, but it changes the header, search and filter UI of hosts that keep the panel. |

## Non-goals

- No change to how project rows, nested chat rows or See all rows render, filter or behave; `ConversationList` stays the owner of that.
- No new props on `ConversationListSection` or `ConversationList`.
- No change to the panel's header, search, filter chips or drag-and-drop behaviour.
- No host-side wiring. How a host builds `PinnedProjects` stays outside the lib.

## Acceptance criteria

- `<ConversationPanel pinnedProjects={…} />` renders the project rows, nested chat rows and See all rows in the Pinned group, and the panel's search text and filter chips filter them as they do under `ConversationListSection`.
- `labels.seeAllLabel` and `labels.seeAllAriaLabel` set the See all row's text and accessible name when passed to `ConversationPanel`; with them omitted the defaults apply.
- With `pinnedProjects` omitted, the rendered output of `ConversationPanel` is unchanged.
- `ConversationPanel.spec.tsx` covers the cases above, and `typecheck`, `lint` and the lib's tests pass.

## Rollback and compatibility

Additive and optional: existing callers compile and render as before. To revert, remove the prop, its forwarding, the two label fields in `listLabels` and the README text; no data, config or migration is involved.

## Impact

- **Code:** `libs/conversation-panel` only: `src/models/panel-props.ts`, `src/components/ConversationPanel/ConversationPanel.tsx`, its spec, and `README.md`.
- **Scope check:** this touches a shared lib, but no app code and no global provider. The lib stays free of host knowledge: ids, names, `href` values, `hasMore` and all callbacks arrive through the `PinnedProjects` prop, as they do for the other two components.
- **APIs:** one optional prop on a public props type; no new exports, since `PinnedProjects` and `PinnedProjectGroup` are already exported.
- **i18n:** no new strings in the lib. The See all text keeps its English defaults, and hosts translate it through `labels`.
- **Release:** published with the next `@epam/ai-dial-conversation-panel` version; hosts get the prop by upgrading.
