Slicing strategy: risk-first. Slice 1 reproduces and fixes the UAT race end to end (overlay state → selection → route). Slice 2 closes with docs and the verification gates.

## 1. Host model as the persistent overlay default

- [x] 1.1 Add `modelId: string | null` to `OverlayContextType` in `apps/chat/src/context/overlay/OverlayContext.tsx`. Set it together with `pendingModelId` on `SET_OVERLAY_OPTIONS`, never clear it, and include it in the memoised context value and its dependencies.
  - Verification: `npm run test:file -- apps/chat/src/context/overlay/tests/OverlayContext.spec.tsx` (keeps `modelId` after `clearPendingModelId`).
- [x] 1.2 Add `modelId: null` to the hand-written `OverlayContextType` mocks in `apps/chat/src/hooks/auth/tests/useOverlayProviderLogin.spec.tsx`, `apps/chat/src/hooks/conversation/tests/useActiveConversationBridge.spec.ts`, and `apps/chat/src/hooks/conversation/tests/useConversationListBridge.spec.ts`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/auth/tests/useOverlayProviderLogin.spec.tsx apps/chat/src/hooks/conversation/tests/useActiveConversationBridge.spec.ts apps/chat/src/hooks/conversation/tests/useConversationListBridge.spec.ts`
- [x] 1.3 In `apps/chat/src/context/DeploymentsContext.tsx`:
  - add the `overlayModelId` argument to `resolveInitialSelection` as step 2, matched via `findDeploymentByIdOrReference`;
  - read `useOptionalOverlay()?.modelId` through `overlayModelIdRef` in the post-fetch resolution and in `restoreDefaultSelection`, whose dependency array stays `[]`;
  - read it live in the late-config effect and add it to that effect's dependency array.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/DeploymentsContext.spec.tsx` (describe `overlay modelId`, which covers: first-time user over the pin; over the persisted selection and the preference; `restoreDefaultSelection` after `restoreSelectedItemId`; match by reference; unknown id falls through; late arrival re-resolves; explicit pick kept).
- [x] 1.4 Move the pending-model effect from `apps/chat/src/app/app.tsx` into `apps/chat/src/hooks/overlay/useOverlayPendingModel.ts`, with JSDoc explaining why it exists. Match via `findDeploymentByIdOrReference`, mount the hook in `app.tsx`, and drop the now-unused `useDeployments` / `useOptionalOverlay` imports there.
  - Verification: `npm run test:file -- apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx`
- [x] 1.5 Add regression tests in `apps/chat/src/pages/ConversationRoute/ConversationRoute.integration.spec.tsx`, running the real `DeploymentsProvider`, `useOverlayPendingModel` and `ConversationRoute` against a stateful overlay stub:
  - a first-time user keeps the host's model after the pending id clears;
  - the host's model wins over a different persisted selection;
  - the next "New chat" after viewing a conversation returns to the host's model.

  Confirm the tests fail against the pre-fix `DeploymentsContext.tsx`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ConversationRoute/ConversationRoute.integration.spec.tsx`

## 2. Docs and gates

- [x] 2.1 Document the `modelId` semantics in `docs/chat-overlay-migration-guide.md`: accepts an id or a reference, applies as soon as deployments load, stays the new-chat default for the session, outranks user and operator defaults, and an unknown value is ignored.
  - Verification: `npm run validate:docs`
- [ ] 2.2 Run `npm run verify:changed` once the local `@epam/ai-dial-ui-kit` matches `package.json` (`^0.15.0-dev.21`).
  - Result after `npm ci` (UI kit `0.15.0-dev.21`): `typecheck:affected` passes. `lint:affected` fails on one `import/order` error in `apps/chat/src/components/CatalogView/CatalogView.tsx:18`, which comes from #9112 and is untouched here. `test:changed` has 2643 passing and 1 failing test (`apps/chat/src/hooks/skills/tests/useSkillFileSystemPicker.spec.ts`), and that test fails on clean `development` too. Left open until both failures, which already exist on `development`, are fixed there.
- [ ] 2.3 Close the change with `npm run verify:full`. Blocked by the same failures noted in 2.2.

## 3. Follow-ups (out of scope)

- [ ] 3.1 If a host needs users to keep their own agent, propose a host-selectable `modelIdMode` (`Enforce` / `Suggest`) in `@epam/ai-dial-chat-overlay`, where `Suggest` yields only to an explicit "Default agent for new chats" preference and never to the persisted `selectedDeploymentId`.
