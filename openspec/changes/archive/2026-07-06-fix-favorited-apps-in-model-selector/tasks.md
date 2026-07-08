## 1. Fix the favorites filter

- [x] 1.1 In `apps/chat/src/components/ModelPicker/ModelPickerPanel.tsx`, extend the `talkableItems` `useMemo` filter to also allow `CatalogEntityType.Application`, alongside the existing `Model` and `Agent` checks.
- [x] 1.2 Verify no other place in `ModelPickerPanel.tsx` (or its mobile bottom-sheet counterpart, if separate) re-applies a narrower type filter that would still exclude `Application`.

## 2. Tests

- [x] 2.1 Add/update a unit test in `apps/chat/src/components/ModelPicker/tests/` asserting a favorited item with `type: CatalogEntityType.Application` is included in the rendered dropdown list.
- [x] 2.2 Add/update a unit test asserting favorited items with non-conversational types (`Toolset`, `Skill`, `Guardrail`, `Mcp`) are still excluded.
- [x] 2.3 Keep/verify the existing test coverage for favorited `Model`/`Agent` items still passes.

## 3. Verification

- [x] 3.1 Run `npm exec nx test chat` (or the affected project test target) and confirm all `ModelPicker` tests pass.
- [x] 3.2 Run `npm exec nx lint chat` for the touched files.
- [x] 3.3 Manually verify in the running app: favorite an Application in the Catalog, open the chat input's model selector, and confirm the Application is selectable.
