## 1. Fix `CatalogView.handleDelete` skill routing

- [x] 1.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, add an
      `else if (item.type === CatalogEntityType.Skill)` branch to
      `handleDelete` (before the final generic `else`) that parses `item.id`
      via `parseSkillResourceUrl`, calls `deleteSkill(bucket, path)` from
      `apps/chat/src/server-api/skills.api.ts`, and calls `refetchSkills()`.
- [x] 1.2 Import `deleteSkill` from `../../server-api/skills.api` (extend
      the existing `downloadSkillFile, listSkillFiles` import) in
      `CatalogView.tsx`.
- [x] 1.3 Guard the `parseSkillResourceUrl` failure case (`null` return) so
      it falls into the existing error path (thrown/caught by
      `handleDelete`'s surrounding `try`/`catch`) rather than calling
      `deleteSkill` with `undefined` bucket/path.
- [x] 1.4 Add `refetchSkills` to `handleDelete`'s `useCallback` dependency
      array alongside the existing `refetchToolsets`, `refetchDeployments`,
      `refetchPrompts`.

## 2. Tests

- [x] 2.1 In `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx`,
      add a test asserting that deleting a `CatalogEntityType.Skill` item
      calls `deleteSkill` with the bucket/path parsed from `item.id`, does
      not call `deleteApplication`, and calls `refetchSkills` (not
      `refetchDeployments`) — mirroring the existing `deleteApplication`
      assertions around line 2167 and the `onUnshare`/skill test pattern
      already in this file.
- [x] 2.2 Add a test asserting a malformed skill `item.id` results in an
      error notification, no call to `deleteSkill` or `deleteApplication`,
      and the confirmation sub-view remaining open (re-thrown rejection).
- [x] 2.3 Confirm existing Prompt/Toolset/application delete tests in the
      same file still pass unchanged (no regressions from the added
      branch).

## 3. Verification

- [x] 3.1 Run `npm exec nx test chat` (or the narrower CatalogView spec) and
      confirm all tests pass.
- [x] 3.2 Run `npm exec nx lint chat` and fix any lint issues introduced.
- [x] 3.3 Manually verify in the running app (`npm run start:all`): open
      Catalog → Skills, delete a skill, confirm it succeeds (no 404) and
      disappears from the list; also spot-check that deleting a Prompt,
      Toolset, and a custom application/deployment still work.
