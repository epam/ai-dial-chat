## 1. Update `deployments-context` spec

- [x] 1.1 In `openspec/specs/deployments-context/spec.md`, update the precedence list inside "Determine the initial `selectedItemId`":
  - Swap items 2 and 3: move `useAppConfig().defaultDeploymentId` to priority 2, `useUserConfig().selectedDeploymentId` to priority 3.
  - Update the four named scenarios to reflect the new order:
    - "Initial selectedItemId follows user config preference" â†’ "Initial selectedItemId follows operator default preference" (adjust WHEN/THEN).
    - "User config preference absent â€” falls back to operator default" â†’ "Operator default absent â€” falls back to user-persisted preference".
    - "User config preference points to unavailable deployment â€” falls through to operator default" â†’ "Operator default not in catalog â€” falls through to user-persisted preference".
    - "User config and operator default absent â€” falls back to first sorted deployment" (unchanged description; still valid).
  - Add a new scenario: "Operator default wins when both operator default and user preference are set".
  - Add the sort-pinning requirement: `sortDeployments` pins the entry matching `defaultDeploymentId` to position 0 after alphabetical sorting, with three scenarios (pinned, absent, not-in-catalog).

  **Verification:** `npm run validate:docs` â€” must pass with no broken links.

---

## 2. Sort hoist â€” tests first

- [x] 2.1 In `apps/chat/src/context/tests/DeploymentsContext.spec.tsx`, add a `describe('sort pinning')` block with the following tests:

  ```ts
  describe('sort pinning', () => {
    it('hoists the operator-default deployment to position 0 when it sorts after other items alphabetically', async () => {
      const zAgent = { id: 'z-agent', displayName: 'Z Agent', type: 'model' as const };
      const pgAgent = { id: 'pg-agent', displayName: 'PG Agent', type: 'model' as const };
      const aAgent = { id: 'a-agent', displayName: 'A Agent', type: 'model' as const };
      mockGetDeployments.mockResolvedValueOnce({ deployments: [zAgent, pgAgent, aAgent] });
      contextMocks.defaultDeploymentId = 'pg-agent';

      const { result } = renderHook(() => useDeployments(), { wrapper: DeploymentsProvider });

      await waitFor(() =>
        expect(result.current.items.map((item) => item.id)).toEqual([
          'pg-agent',
          'a-agent',
          'z-agent',
        ]),
      );
    });

    it('returns a purely alphabetical list when defaultDeploymentId is null', async () => {
      const zebra = { id: 'z-agent', displayName: 'Z Agent', type: 'model' as const };
      const alpha = { id: 'a-agent', displayName: 'A Agent', type: 'model' as const };
      mockGetDeployments.mockResolvedValueOnce({ deployments: [zebra, alpha] });

      const { result } = renderHook(() => useDeployments(), { wrapper: DeploymentsProvider });

      await waitFor(() =>
        expect(result.current.items.map((item) => item.id)).toEqual(['a-agent', 'z-agent']),
      );
    });

    it('returns a purely alphabetical list when defaultDeploymentId is not in the catalog', async () => {
      const zebra = { id: 'z-agent', displayName: 'Z Agent', type: 'model' as const };
      const alpha = { id: 'a-agent', displayName: 'A Agent', type: 'model' as const };
      mockGetDeployments.mockResolvedValueOnce({ deployments: [zebra, alpha] });
      contextMocks.defaultDeploymentId = 'removed-agent';

      const { result } = renderHook(() => useDeployments(), { wrapper: DeploymentsProvider });

      await waitFor(() =>
        expect(result.current.items.map((item) => item.id)).toEqual(['a-agent', 'z-agent']),
      );
    });
  });
  ```

  **Verification:** `npm exec nx test chat -- --reporter=verbose --run` â€” the three new tests must fail (red) since the implementation has not changed yet. All pre-existing tests must remain green.

---

## 3. Sort hoist â€” implementation

- [x] 3.1 In `apps/chat/src/context/DeploymentsContext.tsx`, update `sortDeployments` (lines 105â€“122) to accept an optional third parameter `pinnedId?: string | null`. After the alphabetical sort, splice the pinned entry to index 0 when found:

  ```ts
  const sortDeployments = (
    deployments: DeploymentItemDto[],
    activeLocale: string,
    pinnedId?: string | null,
  ): DeploymentItemDto[] => {
    const sorted = [...deployments].sort((a, b) => {
      const nameCompare = (
        resolveLocalizedText(a.displayName, activeLocale) || a.id
      ).localeCompare(
        resolveLocalizedText(b.displayName, activeLocale) || b.id,
        undefined,
        { sensitivity: 'accent' },
      );
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return a.id.localeCompare(b.id, undefined, { sensitivity: 'accent' });
    });
    if (pinnedId != null) {
      const idx = sorted.findIndex((d) => d.id === pinnedId);
      if (idx > 0) {
        sorted.unshift(sorted.splice(idx, 1)[0]);
      }
    }
    return sorted;
  };
  ```

  Update all four `sortDeployments` call sites to pass `defaultDeploymentIdRef.current` as the third argument:

  - Language-change re-sort (`setRawDeployments` updater, currently `sortDeployments(prev, language)`):
    ```ts
    setRawDeployments((prev) => sortDeployments(prev, language, defaultDeploymentIdRef.current));
    setToolsets((prev) => sortToolsets(prev, language));
    ```
    Note: `sortToolsets` is for toolsets only and does NOT receive a `pinnedId` â€” only `sortDeployments` gets the third argument.

  - Initial load (inside `loadDeployments`, `sortDeployments(deploymentsResult.value.deployments ?? [], languageRef.current)`):
    ```ts
    sortDeployments(
      deploymentsResult.value.deployments ?? [],
      languageRef.current,
      defaultDeploymentIdRef.current,
    )
    ```

  - `refetchDeployments` (`sortDeployments(deployments ?? [], languageRef.current)`):
    ```ts
    sortDeployments(deployments ?? [], languageRef.current, defaultDeploymentIdRef.current)
    ```

  - `mergeSharedItem` deployment branch (`sortDeployments([...prev.filter(...), item], languageRef.current)`):
    ```ts
    sortDeployments(
      [...prev.filter((d) => d.id !== item.id), item],
      languageRef.current,
      defaultDeploymentIdRef.current,
    )
    ```

  **Verification:** `npm exec nx test chat -- --reporter=verbose --run` â€” the three new sort-pinning tests from step 2.1 and all pre-existing tests must be green.

---

## 4. Priority swap â€” tests first

- [x] 4.1 In `apps/chat/src/context/tests/DeploymentsContext.spec.tsx`, make the following test changes:

  a. Update the test `'uses selected deployment from user config when it exists in the list'` to also add a new test that covers the case where both are set:

  Add this new test after it:
  ```ts
  it('prefers the operator default over the user-persisted preference when both are set', async () => {
    contextMocks.defaultDeploymentId = mockItem2.id;
    contextMocks.selectedDeploymentId = mockItem1.id;

    const { result } = renderHook(() => useDeployments(), { wrapper: DeploymentsProvider });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBe(mockItem2.id);
    });
  });
  ```

  b. Update the test `'restoreDefaultSelection re-applies the persisted user preference over a stale in-memory value'`:
  - Update its description to `'restoreDefaultSelection re-applies the operator default over a stale in-memory value when operator default is configured'`.
  - Set `contextMocks.defaultDeploymentId = mockItem1.id` and `contextMocks.selectedDeploymentId = null` (instead of `selectedDeploymentId = mockItem1.id`).
  - The final `expect(result.current.selectedItemId).toBe(mockItem1.id)` remains correct.

  c. Add a test asserting that when no operator default is configured, `restoreDefaultSelection` still uses the user-persisted preference:
  ```ts
  it('restoreDefaultSelection uses the user-persisted preference when no operator default is configured', async () => {
    contextMocks.selectedDeploymentId = mockItem1.id;

    const { result } = renderHook(() => useDeployments(), { wrapper: DeploymentsProvider });

    await waitFor(() =>
      expect(result.current.selectedItemId).toBe(mockItem1.id),
    );

    act(() => {
      result.current.restoreSelectedItemId(mockItem2.id);
    });
    expect(result.current.selectedItemId).toBe(mockItem2.id);

    act(() => {
      result.current.restoreDefaultSelection();
    });

    expect(result.current.selectedItemId).toBe(mockItem1.id);
    expect(contextMocks.setSelectedDeployment).not.toHaveBeenCalled();
  });
  ```

  **Verification:** `npm exec nx test chat -- --reporter=verbose --run` â€” the new `'prefers the operator default...'` test must fail (red); all others must remain green.

---

## 5. Priority swap â€” implementation

- [x] 5.1 In `apps/chat/src/context/DeploymentsContext.tsx`, in `resolveInitialSelection` (lines 143â€“162), swap the `userConfigId` and `operatorDefaultId` check blocks so `operatorDefaultId` is priority 2 and `userConfigId` is priority 3:

  ```ts
  const resolveInitialSelection = (
    deployments: DeploymentItemDto[],
    inMemoryId: string | null,
    userConfigId: string | null,
    operatorDefaultId: string | null,
  ): string | null => {
    if (inMemoryId != null && deployments.some((d) => d.id === inMemoryId)) {
      return inMemoryId;
    }
    if (
      operatorDefaultId != null &&
      deployments.some((d) => d.id === operatorDefaultId)
    ) {
      return operatorDefaultId;
    }
    if (userConfigId != null && deployments.some((d) => d.id === userConfigId)) {
      return userConfigId;
    }
    return deployments[0]?.id ?? null;
  };
  ```

  No changes to any of the three call sites â€” the parameter positions are unchanged.

  **Verification:** `npm exec nx test chat -- --reporter=verbose --run` â€” full suite including all new and modified tests from steps 2.1 and 4.1 must be green.

---

## 6. Final verification

- [x] 6.1 Run `npm exec nx lint chat` â€” zero lint errors.
- [x] 6.2 Run `npm exec nx typecheck chat` â€” zero TypeScript errors.
- [x] 6.3 Run `npm exec nx test chat` â€” full test suite green.
- [ ] 6.4 Run `npm run validate:docs` â€” currently blocked by the pre-existing `libs/chat-hooks/README.md` reference to non-exported `useGridEditingScroll`; this change adds no new docs-validation errors.

---

## 7. Opt-in feature flag and late-config safety

- [x] 7.1 Register client-visible `DEFAULT_DEPLOYMENT_PINNED` with a default of `false` and parse raw string boolean values safely.
- [x] 7.2 Gate both operator-default priority and list pinning; preserve user-preference precedence and alphabetical ordering while disabled.
- [x] 7.3 Re-sort and re-resolve automatic fallback selection when app config arrives after the catalog without overriding explicit user or conversation selection.
- [x] 7.4 Add frontend and backend regression tests for disabled behavior, late config, explicit selection, registry metadata, and boolean env parsing.
- [x] 7.5 Document the flag in `apps/chat-api/.env.template` and `apps/chat-api/README.md`.
- [x] 7.6 Run targeted frontend/backend tests, frontend/backend lint, frontend typecheck, and strict `deployments-context` OpenSpec validation.
- [ ] 7.7 Run `npm exec nx typecheck @epam/chat-api` â€” blocked by pre-existing backend type errors outside this change; the changed backend tests compile and pass.
- [x] 7.8 Keep the operator default visible at the top of the compact selector when an existing conversation restores another deployment; preserve favorite state and avoid duplicates.
- [x] 7.9 Keep `restoreDefaultSelection` stable across persisted user-selection updates so a manual agent switch is not reset to the operator default.

