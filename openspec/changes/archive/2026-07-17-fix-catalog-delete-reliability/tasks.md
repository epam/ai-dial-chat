## 1. Backend: wire ApplicationsModule to DeploymentsModule

- [x] 1.1 In `apps/chat-api/src/applications/applications.module.ts`, add `DeploymentsModule` to
      the `imports` array (mirroring `apps/chat-api/src/toolsets/toolsets.module.ts`).
- [x] 1.2 In `apps/chat-api/src/applications/applications.service.ts`, constructor-inject
      `deploymentsService: DeploymentsService` (plain injection, no `@Inject` token, matching
      `ToolsetsService`'s constructor).

## 2. Backend: invalidate the deployments list cache on delete

- [x] 2.1 In `ApplicationsService.deleteApplication`, after the existing
      `this.cacheManager.del(\`applications:list:${userSub}\`)` call succeeds, call
      `await this.deploymentsService.invalidateListCache(userSub)`.
- [x] 2.2 Update the debug log message to note both caches were invalidated (optional, matches
      existing log style).
- [x] 2.3 Grep `apps/chat-api/src` for other `applications:` / `deployments:list` cache-key
      literals to confirm no other stale-read path was missed (per design.md's risk note).

## 3. Backend: tests

- [x] 3.1 Add/update a unit test for `ApplicationsService.deleteApplication` asserting
      `DeploymentsService.invalidateListCache` is called with the correct `userSub` on
      successful delete, and NOT called when the DIAL Core delete call errors.
- [x] 3.2 Run `npm exec nx test chat-api` and confirm the new/updated tests pass.

## 4. Frontend: delete button loading indicator

- [x] 4.1 In `libs/catalog/src/components/Details/Header/DeleteButton/DeleteButton.tsx`, pass a
      loading/spinner affordance to `NeutralButton` while `isDeleting` is true (check
      `@epam/ai-dial-kit`'s `NeutralButton` for a built-in loading prop before adding a manual
      spinner; keep the button `disabled` as-is).
- [x] 4.2 Confirm the button's `aria-label`/label text stays stable during loading (per
      `.claude/rules/a11y.md`) — do not swap to loading-only text with no stable accessible name.

## 5. Verification

- [x] 5.1 `npm exec nx lint chat-api` and `npm exec nx lint catalog` (or the affected lib
      project name) pass.
- [x] 5.2 `npm exec nx build chat-api` passes (confirms no circular module dependency between
      `ApplicationsModule` and `DeploymentsModule`).
- [ ] 5.3 Manually reproduce the original repro steps from GitHub #7791 against a local
      `npm run start:all`: delete an application from the Catalog Details panel, confirm no
      stale reappearance, delete a second item successfully, and refresh the page to confirm
      the deleted item stays gone.
