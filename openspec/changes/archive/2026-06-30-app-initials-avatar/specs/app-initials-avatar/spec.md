# Spec: app-initials-avatar

## ADDED Requirements

### Requirement: `extractInitials` returns 1–2 uppercase characters from a display name

`extractInitials` (in `libs/chat-shared/src/utils/initials.ts`) SHALL accept a `name: string` parameter and return a 1–2 character uppercase string:
- If `name` (after trimming) is empty, it SHALL return `"?"`.
- If `name` contains two or more whitespace-separated words, it SHALL return the **first Unicode letter** (`\p{L}`) of each of the first two words, uppercased. Non-letter characters (brackets, punctuation) at the start of a word are skipped.
- If `name` contains only one word, it SHALL return the first two Unicode letters of that word, uppercased. Non-letter prefix characters are skipped.
- If no Unicode letter can be extracted, it SHALL return `"?"`.

i18n: none — initials are derived from the deployment's existing `displayName` field which is already locale-aware from the backend.

RTL impact: none — the initials are rendered inside a centred badge; LTR/RTL direction does not change the visual result.

Feature flag: none.

Memoisation: `extractInitials` is a pure synchronous function; callers do not need to memoize the call.

Accessibility: the `InitialsAvatar` component that uses this function SHALL set `aria-hidden="true"` on the badge and rely on the surrounding element's `aria-label` (provided by the parent deployment-icon caller) for screen reader context.

Observability: none.

#### Scenario: Multi-word name produces two initials

- **WHEN** `extractInitials("My Application")` is called
- **THEN** it returns `"MA"`

#### Scenario: Single-word name produces two characters

- **WHEN** `extractInitials("Summarizer")` is called
- **THEN** it returns `"SU"`

#### Scenario: Empty string returns question mark fallback

- **WHEN** `extractInitials("")` is called
- **THEN** it returns `"?"`

#### Scenario: Extra whitespace is normalised

- **WHEN** `extractInitials("  Hello   World  ")` is called
- **THEN** it returns `"HW"`

#### Scenario: Single-character name returns one character

- **WHEN** `extractInitials("X")` is called
- **THEN** it returns `"X"`

#### Scenario: Leading bracket in word is skipped

- **WHEN** `extractInitials("[StatGPT] Global Trusted")` is called
- **THEN** it returns `"SG"` (the `[` is skipped; first letter of each word is used)

---

### Requirement: `pickAvatarColor` deterministically maps a name to a palette entry

`pickAvatarColor` (in `libs/chat-shared/src/utils/avatar-color.ts`) SHALL accept a `name: string` parameter and return `{ background: string; foreground: string }` where both values are CSS colour strings (hex or named). The mapping SHALL be deterministic (same input always produces the same output) and SHALL use a fixed palette of at least 6 and at most 12 entries, each meeting WCAG AA contrast (≥ 4.5:1 for text on background).

Feature flag: none. Observability: none.

#### Scenario: Same name always returns same color

- **WHEN** `pickAvatarColor("My App")` is called twice
- **THEN** both calls return identical `{ background, foreground }` objects

#### Scenario: Different names may return different colors

- **WHEN** `pickAvatarColor("Alpha")` and `pickAvatarColor("Beta")` are called
- **THEN** the results are not required to be different, but the palette MUST contain entries that differ from each other

#### Scenario: Empty string returns a valid palette entry

- **WHEN** `pickAvatarColor("")` is called
- **THEN** it returns a valid `{ background, foreground }` pair from the palette without throwing

---

### Requirement: `InitialsAvatar` renders a coloured square badge with initials

`InitialsAvatar` (in `libs/chat-shared/src/components/InitialsAvatar/InitialsAvatar.tsx`) SHALL:
- Accept props: `name: string`, `size: number`, `className?: string`.
- Render a square element of `size × size` pixels with `border-radius: 6px` (matching `DeploymentIcon`'s badge shape).
- Use `pickAvatarColor(name)` to set the inline background colour.
- Render `extractInitials(name)` as centred text using the foreground colour from `pickAvatarColor`.
- Export `InitialsAvatarProps` interface with JSDoc on every field.
- Set `aria-hidden="true"` on the root element.
- Accept `className` for structural overrides (e.g., `shrink-0`).

Font size SHALL scale proportionally: `Math.round(size * 0.4)` px. This ensures readability at the common sizes used in the app (18 px icon → ~7 px text, 36 px → ~14 px text).

RTL impact: the badge is symmetric; no logical-property changes are needed. Text is centred, not aligned to start/end.

#### Scenario: Renders initials from name

- **WHEN** `<InitialsAvatar name="My App" size={36} />` is rendered
- **THEN** the rendered text content is `"MA"`

#### Scenario: Background color is applied inline

- **WHEN** `<InitialsAvatar name="Alpha" size={36} />` is rendered
- **THEN** the root element has an inline `style.backgroundColor` equal to `pickAvatarColor("Alpha").background`

#### Scenario: Accessible — aria-hidden is set

- **WHEN** `InitialsAvatar` renders
- **THEN** the root element has `aria-hidden="true"`

---

### Requirement: `FallbackEntityIcon` is removed; `DeploymentIcon` always falls back to `InitialsAvatar`

`libs/chat-shared/src/assets/fallback-entity-icon.svg` SHALL be deleted. `DeploymentIcon` SHALL remove all imports of `FallbackEntityIcon`. The default `fallback` prop SHALL be replaced with `<InitialsAvatar name={initialsName} size={size} className="shrink-0" />`.

`DeploymentIcon` SHALL accept a **required** `initialsName: string` prop. When no image is available (`src` is absent or the image has errored), the component SHALL always render `<InitialsAvatar name={initialsName} size={size} className="shrink-0" />`. When `initialsName` is empty the avatar renders `"?"` initials.

The generic `fallback?: ReactNode` prop is retained for truly custom overrides; its default is no longer `FallbackEntityIcon`.

RTL impact: `InitialsAvatar` is symmetric; no direction-specific classes needed in `DeploymentIcon`.

Feature flag: none. Observability: none.

#### Scenario: InitialsAvatar shown when src is absent and initialsName is provided

- **WHEN** `<DeploymentIcon size={36} initialsName="My App" />` renders (no `src` prop)
- **THEN** an `InitialsAvatar` with `name="My App"` is rendered

#### Scenario: InitialsAvatar with question-mark fallback when initialsName is empty

- **WHEN** `<DeploymentIcon size={36} initialsName="" />` renders with no `src`
- **THEN** an `InitialsAvatar` with `name=""` is rendered (showing `"?"`) and no `FallbackEntityIcon` appears

#### Scenario: InitialsAvatar shown when src errors

- **WHEN** `<DeploymentIcon src="https://broken.invalid/img.png" size={36} initialsName="My App" />` renders and the image fires an error event
- **THEN** an `InitialsAvatar` with `name="My App"` is rendered

#### Scenario: Image rendered when src is valid

- **WHEN** `<DeploymentIcon src="https://valid.example/icon.png" size={36} initialsName="My App" />` renders and the image loads successfully
- **THEN** the image is displayed and no `InitialsAvatar` appears

---

### Requirement: `buildDeploymentIcon` removes `FallbackEntityIcon` and always routes through `DeploymentIcon`

`buildDeploymentIcon` (in `libs/conversation-input/src/utils/deployment.tsx`) SHALL remove all imports and direct renders of `FallbackEntityIcon`. The function signature is:

```ts
buildDeploymentIcon(
  resolvedIconUrl: string | undefined,
  type: string | undefined,
  displayName: string,          // required, 3rd position
  size?: number,                // default 18
  tooltip?: string,
): ReactNode
```

`displayName` is a **required** parameter placed before the optional `size` and `tooltip`. It is always passed as `initialsName` to `DeploymentIcon`. When `displayName` is `""` the avatar renders `"?"` initials.

#### Scenario: InitialsAvatar via buildDeploymentIcon when no icon URL and displayName provided

- **WHEN** `buildDeploymentIcon(undefined, undefined, "My App")` is called
- **THEN** the returned node renders `DeploymentIcon` which shows an `InitialsAvatar` with `name="My App"`

#### Scenario: Image icon via buildDeploymentIcon when URL is present

- **WHEN** `buildDeploymentIcon("https://valid.example/icon.png", undefined, "My App")` is called
- **THEN** the returned node renders `DeploymentIcon` with the given `src`

#### Scenario: Question-mark initials when displayName is empty

- **WHEN** `buildDeploymentIcon(undefined, undefined, "")` is called
- **THEN** the returned node renders `DeploymentIcon` which shows an `InitialsAvatar` with `name=""` (displaying `"?"`) — no `FallbackEntityIcon` appears

---

### Requirement: `apps/chat` catalog and conversation-header callsites pass `displayName` for application icons

All locations in `apps/chat/src/` that call `buildDeploymentIcon` (or render `DeploymentIcon` directly) for user-created applications SHALL pass the deployment's `displayName` (or the display label) as the `displayName` / `initialsName` argument so that the initials avatar is shown when no custom image is set.

i18n: the `displayName` value is sourced from the backend (`DeploymentItem.displayName`) and is already localised; no additional i18n keys are introduced.

RTL impact: none beyond what is already handled by `InitialsAvatar`.

Accessibility: no additional ARIA attributes are required at the callsite; `InitialsAvatar` sets `aria-hidden` and the parent icon container's existing `aria-label` (where present) provides screen reader context.

#### Scenario: Initials shown in catalog card for app without custom icon

- **WHEN** the catalog renders an application with `displayName="My App"` and no `iconUrl`
- **THEN** the application card shows an `InitialsAvatar` badge with text `"MA"`

#### Scenario: Custom icon still shown when iconUrl is set

- **WHEN** the catalog renders an application with a valid `iconUrl`
- **THEN** the application card shows the image icon, not the initials badge
