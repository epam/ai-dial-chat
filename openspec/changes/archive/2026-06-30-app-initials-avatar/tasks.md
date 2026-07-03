## 1. Utilities in `libs/chat-shared`

- [x] 1.1 Create `libs/chat-shared/src/utils/initials.ts` — export `extractInitials(name: string): string` with the multi-word / single-word / empty-string logic
- [x] 1.2 Create `libs/chat-shared/src/utils/avatar-color.ts` — export `AvatarColorEntry` interface and `pickAvatarColor(name: string): AvatarColorEntry` with the fixed 8-colour WCAG-AA palette and char-code-sum hash
- [x] 1.3 Write Vitest unit tests for `extractInitials` covering: multi-word, single-word, empty string, extra whitespace, single-char name
- [x] 1.4 Write Vitest unit tests for `pickAvatarColor` covering: same name → same result, empty string → valid entry, no throw

## 2. `InitialsAvatar` component in `libs/chat-shared`

- [x] 2.1 Create `libs/chat-shared/src/components/InitialsAvatar/InitialsAvatar.tsx` — `FC<InitialsAvatarProps>` with `name`, `size`, optional `className`; renders coloured badge with initials; `aria-hidden="true"`; font size `Math.round(size * 0.4)` px via inline style
- [x] 2.2 Export `InitialsAvatar` and `InitialsAvatarProps` from `libs/chat-shared/src/index.ts`
- [x] 2.3 Write Vitest + Testing Library tests for `InitialsAvatar`: correct text content, `aria-hidden`, background colour applied as inline style

## 3. Update `DeploymentIcon` in `libs/chat-shared`

- [x] 3.1 Add `initialsName: string` (required) to `DeploymentIconProps` with JSDoc; replace the `FallbackEntityIcon` default `fallback` with `<InitialsAvatar name={initialsName} size={size} className="shrink-0" />`; remove `FallbackEntityIcon` import
- [x] 3.2 Delete `libs/chat-shared/src/assets/fallback-entity-icon.svg` once no other imports remain (verify with grep before deleting)
- [x] 3.3 Update `DeploymentIcon` unit tests: `InitialsAvatar` shown when `src` absent with `initialsName`, `InitialsAvatar` shown after image error, `InitialsAvatar` with `name=""` shown when `initialsName` absent (no `FallbackEntityIcon` scenario)
- [x] 3.4 Run `npm exec nx test chat-shared` and `npm exec nx lint chat-shared` — fix any failures

## 4. Update `buildDeploymentIcon` in `libs/conversation-input`

- [x] 4.1 Remove `FallbackEntityIcon` import from `libs/conversation-input/src/utils/deployment.tsx`; remove the `FallbackEntityIcon` render branches; add required 3rd parameter `displayName: string` (before `size`); always return `<DeploymentIcon ... initialsName={displayName} />`
- [x] 4.2 Update / add unit tests for `buildDeploymentIcon` covering the three scenarios from the spec (initials shown, image shown, `"?"` when no displayName)
- [x] 4.3 Run `npm exec nx test conversation-input` and `npm exec nx lint conversation-input`

## 5. Update `libs/catalog` callsites

- [x] 5.1 In `libs/catalog/src/components/AppIdentity/AppIdentity.tsx` — pass `name` (or existing display-name prop) as `initialsName` to `DeploymentIcon`
- [x] 5.2 In `libs/catalog/src/components/CardGrid/Card.tsx` — ensure `AppIdentity` (or `DeploymentIcon` directly if used) receives `initialsName`
- [x] 5.3 Run `npm exec nx test catalog` and `npm exec nx lint catalog`

## 6. Update `apps/chat` callsites

- [x] 6.1 In `apps/chat/src/components/ModelPicker/ModelPickerPanel.tsx` — pass `displayName` (from `DeploymentItem`) as `displayName` / `initialsName` to the icon call
- [x] 6.2 Search for other direct `buildDeploymentIcon` / `DeploymentIcon` usages in `apps/chat/src/` and pass `displayName` where available
- [x] 6.3 Run `npm exec nx lint chat` — fix any type errors

## 7. Final verification

- [x] 7.1 Run `npm exec nx affected --target=typecheck --base=origin/development-1.0` across affected projects
- [x] 7.2 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all tests green
- [x] 7.3 Start the dev server (`npm start`) and manually verify: open the catalog, confirm an app without a custom icon shows a coloured initials badge; confirm apps with a custom icon still show the image
