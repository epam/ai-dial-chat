## Context

`SettingsPage` is small and holds everything in one place:

```tsx
const [activeTab, setActiveTab] = useState<SettingsTabs>(SettingsTabs.Preferences);
const ActiveTabComponent = tabComponents[activeTab];
```

`useSettingsTabConfig` supplies `items` (the panel rows) and `tabComponents` (id → component), and
`SettingsTabs` is a string enum whose members are already URL-shaped (`'usage'`, `'preferences'`).
That last fact is what makes this change small: the enum value can be the path segment directly, so
no separate slug map is needed.

The route is registered once in `apps/chat/src/app/app.tsx:360` at `ROUTES.Settings`, wrapped in
`RouteErrorBoundary` + `Suspense`, and gated on `OverlayFeature.HideSettingsPage` by swapping the
element for `<Navigate to={ROUTES.Root} replace />`.

`useSearchParams`/route-param reading is already established in the app —
`ScheduledTaskCreatePage`, `PromptEditor`, `ToolsetEditor` and `CustomAppEditor` all do it — so this
introduces no new pattern.

**Constraint:** the in-flight `add-settings-preferences-tab` change edits
`useSettingsTabConfig.tsx` and instructs "Do not touch `SettingsPage.tsx`". This change is the
mirror image — it touches `SettingsPage.tsx` and the route table but not the tab config — so the two
are disjoint by file. It still lands after that change archives.

## Goals / Non-Goals

**Goals:**

- One canonical, linkable URL per Settings tab.
- Tab survives reload and participates in browser history.
- A working target for the usage popover's "full usage" link.
- Adding a future tab still requires only an enum member and a config entry.

**Non-Goals:**

- Changing which tabs exist, their order, or their labels.
- Nested sub-routes within a tab.
- Deep-linking anywhere else in the app.

## Decisions

### Decision 1 — A single dynamic route segment, not one route per tab

Register one route, `/settings/:tab`, rather than enumerating `/settings/usage`,
`/settings/preferences`, … in `app.tsx`.

*Why:* the tab set is owned by `useSettingsTabConfig`, and the spec's existing promise is that a new
tab needs "only a new enum member and a new config entry, with no changes to `SettingsPage`'s
rendering logic or to the `/settings` route registration". Enumerating routes would break that
promise — every new tab would need a route too. A dynamic segment keeps the route table stable.

*Alternative:* explicit child routes per tab, which would give React Router the 404 for free.
Rejected for the reason above; validation moves into `SettingsPage` instead (Decision 3).

### Decision 2 — `ROUTES` gains the pattern and a helper, not one member per tab

`ROUTES.SettingsTab = '/settings/:tab'` joins the enum beside the existing `ROUTES.Settings`,
following the `ScheduledTaskDetail = '/scheduled-tasks/:scheduleId'` precedent already in the file.
Call sites that need a concrete URL build it through a small helper rather than interpolating the
pattern inline:

```ts
export const getSettingsTabRoute = (tab: SettingsTabs): string =>
  `${ROUTES.Settings}/${tab}`;
```

*Why:* `ROUTES` is a route *pattern* table — `ScheduledTaskDetail` is already a pattern, not a
navigable URL. One member per tab would duplicate the enum that already exists, and would have to be
extended for every future tab, which Decision 1 exists to avoid.

*Where it lives:* `apps/chat/src/constants/routes.ts`, which already holds `getConversationRoute`,
`getScheduledTaskDetailRoute` and `getScheduledTaskEditRoute` — route builders have an established
home, and its `getXxxRoute` naming and `` `${ROUTES.Parent}/${segment}` `` shape are the pattern to
follow. Building by interpolation rather than by substituting into the `:tab` pattern also removes a
silent failure mode: `':tabId'.replace(':tab', 'usage')` yields `'usageId'`, a wrong path with no
leftover colon for a test to catch.

### Decision 3 — `SettingsPage` validates the segment and redirects, rather than rendering an empty shell

`SettingsPage` reads `useParams<{ tab: string }>()` and resolves it against the ids
`useSettingsTabConfig` actually returned — not against the `SettingsTabs` enum. A segment that names
no configured tab, or names one the config withheld (a tab gated off by a flag), redirects with
`<Navigate to={getSettingsTabRoute(defaultTab)} replace />`.

Validating against the live config rather than the enum matters: a tab can exist in the enum while
its config entry is absent, and rendering `tabComponents[tab]` for that id yields `undefined` — the
current code already guards with `{ActiveTabComponent && …}`, which silently renders an empty pane.
A redirect is the honest outcome.

`replace` is used so a mistyped URL does not sit in history between the user and Back.

*Default tab:* the first entry of `items`, not a hardcoded member. `useSettingsTabConfig` owns the
order, and hardcoding `Usage` or `Preferences` here would put the default in two places and break
the moment the config reorders.

### Decision 4 — Selecting a tab navigates; the URL is the only source of truth

`onSelect` calls `navigate(getSettingsTabRoute(id))` instead of `setActiveTab`. The `useState` is
removed entirely rather than mirrored, so there is exactly one source of truth and no effect
synchronising the two.

A normal push (not `replace`) so Back steps between tabs, which is the behaviour the proposal
promises. Reaching Settings and then leaving costs one Back press per tab visited — the accepted
cost of tabs being locations.

### Decision 5 — `/settings` redirects rather than rendering the default tab

`/settings` stays registered and renders `<Navigate to={getSettingsTabRoute(defaultTab)} replace />`
under the same flag gate.

*Why not render the default tab at `/settings` directly:* two URLs would then show the same tab, and
the one the user sees in the address bar would depend on how they arrived. Redirecting gives each
tab exactly one canonical URL.

The flag gate is applied to both route entries. A disabled Settings page must not be reachable
through `/settings/usage` either, and the gate is what guarantees the lazy chunk never mounts.

### Decision 6 — The popover's link is an app-built `footerNote`

`LimitsTab` already accepts `footerNote?: ReactNode` and renders it under the groups with a top
border. `UsageLimitsControl` passes a `react-router` `<Link>` to `getSettingsTabRoute(SettingsTabs.Usage)`
carrying a translated label.

*Isolation:* the lib gains nothing — no route, no `react-router`, no new prop. This is the
prop-carries-resolved-behaviour pattern `AGENTS.md` §Library isolation prescribes, and `footerNote`
exists precisely for it ("e.g. a link to a full usage-limits page" is its documented purpose).

The link must close the popover on activation, or the user navigates with a dialog still mounted
over the destination.

### Decision 7 — The settings route pair lives in its own module, so the gate is testable

Discovered during implementation: the repository has **no test for `app.tsx`'s route table at all**,
and `App` is a 36-import component wired to a dozen contexts, so mounting it to assert two redirects
would be disproportionate and brittle. The `settings-page-shell` scenarios about the disabled-flag
redirect were, in practice, never covered.

`renderSettingsRoutes(isSettingsPageHidden)` therefore lives in `apps/chat/src/app/settings-routes.tsx`
and returns the `<Route>` elements `app.tsx` spreads into its `<Routes>`. It owns the lazy
`SettingsPage` import, so the chunk boundary moves with it. A test mounts the returned routes in a
`MemoryRouter` with the page mocked, and covers both paths in both flag states cheaply.

Generating both paths from one array with one gate expression also makes the bypass this guards
against structurally impossible: there is no place to add a settings path that skips the gate.

*Alternative:* leave the gate inline in `app.tsx` and accept it stays untested, as it was before.
Rejected — the spec asserts the behaviour, so something should hold it.

## Risks / Trade-offs

1. **[Merge conflict with `add-settings-preferences-tab`]** → The two changes are disjoint by file:
   that one edits `useSettingsTabConfig.tsx` and is fenced off `SettingsPage.tsx`; this one edits
   `SettingsPage.tsx` and the route table and does not touch the tab config. Land this after that
   change archives, and re-run its tab tests here.

2. **[Back now steps between tabs, which some users read as "leaving Settings should be one press"]**
   → This is the deliberate trade in Decision 4 and the behaviour the proposal commits to; tabs that
   are locations behave like locations. If it proves annoying, `replace` on tab selection reverses
   it without touching anything else.

3. **[A tab id that is not URL-safe would silently produce a broken path]** → `SettingsTabs` members
   are lowercase ASCII today. The builder does not encode, so a future member with a space or slash
   would break. Mitigated by a test asserting every `SettingsTabs` member round-trips through
   `getSettingsTabRoute` and back, which fails the moment someone adds an unsafe id.

4. **[The redirect could loop if the default tab itself fails to resolve]** → The default is taken
   from `items[0]`, and the redirect only fires when the segment does not match a configured id; a
   default drawn from that same list always matches. If `items` is ever empty the page renders its
   empty state rather than redirecting — guard for it explicitly rather than navigating.

5. **[`docs/architecture.md` lists routes and goes stale silently]** → Updated in this change, as
   `AGENTS.md` requires for any `ROUTES` enum change.

## Migration Plan

No data, no stored state, no API. A single frontend deploy. `/settings` keeps resolving, so no
external link breaks. Rollback is `git revert`: tabs return to local state and the popover's footer
link goes with it.

## Open Questions

- Should the tab segment be localised or aliased (`/settings/использование`)? Assumed no — every
  other route in the app is an English slug.
- Should `/settings/usage` preserve a period filter in the URL later? Out of scope here; the
  single-segment shape leaves room for it.
