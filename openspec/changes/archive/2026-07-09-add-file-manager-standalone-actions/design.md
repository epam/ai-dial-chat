## Context

`DialFileManagerVariant` (`Attach`/`Standalone`/`FolderPicker`) and `DialFileManagerActionProfile` (`Attach`/`Browse`/`Full`) were introduced during the `#7502` shell-extraction work, with `deriveActionProfile(variant)` mapping `Attach→Attach`, `Standalone→Browse`, `FolderPicker→Full`. At that point, `useDialFileManager.ts`'s `actionLabels` computation only needed to handle Delete and Rename, and both were already tab-gated (`my_files` only) and permission-gated (`uploadEnabled`) — Attach and Browse computed identical results, so the author left an explicit comment deferring the `actionProfile` branch and added an exhaustiveness-only `switch` as a placeholder:

```ts
// `actionProfile` is not yet branched on below (see design.md Decision 3 —
// Attach and Browse must compute identical actionLabels in this change);
// this switch only guards that every profile is deliberately accounted for.
switch (actionProfile) {
  case DialFileManagerActionProfile.Attach:
  case DialFileManagerActionProfile.Browse:
  case DialFileManagerActionProfile.Full:
    break;
  default: {
    const exhaustiveCheck: never = actionProfile;
    throw new Error(`Unhandled actionProfile: ${String(exhaustiveCheck)}`);
  }
}
```

`add-file-manager-copy-move` and `add-file-manager-duplicate` each added Copy/Move/Duplicate to the same `activeTab === MyFiles && uploadEnabled` gate, without revisiting this comment — each of those changes' own design docs listed "Attach modal `actionProfile=Attach` unchanged" as a regression check, but none of them actually wired the gate, because at the time each shipped, `DialFileManagerModal` (the only `Attach`-profile consumer) happened to not yet expose Copy/Move (slice 1) or Duplicate (slice 3) in a way anyone had reason to test against — the check passed only because nobody looked for the *absence* of a feature that had just been added everywhere it was reachable.

Reading the current code directly (not assuming) confirms `DialFileManagerModal` today, when browsing `my_files` with WRITE permission, renders Copy/Move/Duplicate exactly as `DialFileManagerPage` does — `DialFileManagerShell` is shared unconditionally between both hosts and wires `onCopyFiles`/`onMoveToFiles`/`isCopying`/`isMoving`/`cancelCopyMove`/`OperationLoaderModal` regardless of variant. This was confirmed with the reporter as unintended: the attach flow is a file *picker* for composing a chat message, not a file-management surface, and Copy/Move/Duplicate should not have leaked into it. Rename's presence in the attach modal is different — it was deliberately added there in `add-file-manager-rename`, before the `variant`/`actionProfile` split existed, as an explicit product decision predating this whole variant system. That decision is not being revisited.

## Goals / Non-Goals

**Goals:**
- Resolve the deferred `actionProfile` branch: `Copy`/`Move`/`Duplicate` are included in `actionLabels` only when `actionProfile !== DialFileManagerActionProfile.Attach` (i.e. `Browse` or `Full`), in addition to the existing `activeTab === MyFiles && uploadEnabled` gate.
- Remove the now-inaccurate placeholder comment and the exhaustiveness-only `switch`, replacing it with the real conditional (which remains exhaustively typed against the enum via a `switch`/lookup so a future new profile value cannot be silently un-handled).
- Add regression tests proving the attach modal no longer exposes Copy/Move/Duplicate, while continuing to expose Rename/Delete unchanged, and that the standalone page's full matrix is unaffected.
- Formalize `file-manager-tabs`'s action-visibility requirement with an explicit `actionProfile` column, closing the ambiguity the requirement's prose left open across three prior changes.

**Non-Goals:**
- Switching `DialFileManagerPage` from `Browse` to `Full` — see Decision D2.
- Any change to Rename's or Delete's gating.
- Implementing `Full`'s eventual `#7504` behavior (Share/Unshare/Remove access/Info).
- Implementing `DialFileManagerVariant.FolderPicker`.
- Any change to the attach modal's own props/behavior beyond what `actionLabels` computes — `DialFileManagerModal.tsx` itself needs no code change; the fix is entirely inside `useDialFileManager.ts`.

## Decisions

### D1 — Gate Copy/Move/Duplicate on `actionProfile !== Attach`; leave Rename/Delete alone

**Decision**: in `useDialFileManager.ts`'s `actionLabels` `useMemo`, wrap the existing `Copy`/`Move`/`Duplicate` assignments (currently inside the `if (activeTab === MyFiles) { if (uploadEnabled) { ... } }` block) in an additional `actionProfile !== DialFileManagerActionProfile.Attach` check. `Rename` and `Delete` keep their current, unconditional-on-profile gating.

**Rationale**: this is the minimal fix that resolves the deferred comment without touching any behavior that was a deliberate, already-reviewed decision (Rename in Attach) or any behavior that doesn't currently exist (Full's extra actions). Scoping the fix to exactly the three actions that leaked in unintentionally avoids scope creep into re-deciding Rename's attach availability, which nobody asked to revisit.

**Alternative considered**: gate the *entire* `my_files`-WRITE block (including Rename/Delete) on `actionProfile !== Attach` — rejected because it would remove Rename and Delete from the attach modal too, a behavior change nobody requested and one that contradicts the explicit, separate decision made in `add-file-manager-rename`.

### D2 — `DialFileManagerPage` stays on `Browse`, does not switch to `Full`

**Decision**: `DialFileManagerPage.tsx` continues to pass `actionProfile: DialFileManagerActionProfile.Browse`.

**Rationale**: the original roadmap's step-12 note said "Switch `actionProfile` from `Browse` to `Full` once slice 4 complete" — written when `Full` was expected to represent "the complete #7503 action set." Since `Full` was always intended (per `file-manager-variant.ts`'s own doc comment: `` `Full` is reserved for `DialFileManagerVariant.FolderPicker` (#7503+) ``) to eventually mean *#7504's* full legacy parity (Share/Unshare/Remove access/Info) rather than merely "#7503's minimum," relabeling the current, #7503-only behavior as `Full` now would misrepresent it — a future reader would reasonably assume `actionProfile: Full` already includes Share/Info, which it does not. `Browse` accurately describes "browse my files and use the #7503 minimum action set" and should stay `Browse` until `#7504` actually extends it — at which point that change decides whether to introduce a fourth profile, extend `Browse`, or finally activate `Full`.

**Alternative considered**: rename `Full` to describe today's matrix and introduce a *new* enum value for #7504's later, larger scope — rejected as unnecessary churn; simplest is to leave `Browse` doing what it already correctly does and leave `Full` reserved exactly as `file-manager-variant.ts` already documents it.

### D3 — Replace the placeholder `switch` with a real, still-exhaustive branch

**Decision**: the `actionProfile !== Attach` check for Copy/Move/Duplicate is a plain boolean condition; the exhaustiveness guarantee for `DialFileManagerActionProfile` is preserved by keeping a `switch` (or equivalent lookup) somewhere `actionProfile` is consumed, so that adding a fourth enum value in a future change still fails to compile until every consumer is updated — but the guard no longer needs to be a *no-op* `switch` whose only job was documenting a deferred decision, since the decision is no longer deferred.

**Rationale**: TypeScript's `never` exhaustiveness check is valuable and should be kept, but it belongs attached to a real decision point, not floating above one as a comment explaining why nothing happens yet.

## Risks / Trade-offs

**Removing Copy/Move/Duplicate from the attach modal is a visible behavior change** → any tester or stakeholder who saw these actions working in the attach modal during `add-file-manager-copy-move`/`add-file-manager-duplicate`'s review period will see them disappear. Mitigation: this was confirmed with the reporter as the intended fix, not a regression to avoid; the change is called out explicitly in the proposal's Impact section so it's not a silent removal.

**`Browse` vs `Full` naming may still confuse future readers** → someone skimming `DialFileManagerActionProfile` without this design doc's context might still wonder why the standalone page uses `Browse` when a `Full` value exists. Mitigation: `file-manager-variant.ts`'s existing doc comment already states `Full` is reserved for a specific future use; this change does not need to add more commentary there, but `file-manager-tabs`'s spec update (this change) is the durable record of *why* `Browse` remains correct for #7503.

## Migration Plan

1. Add the `actionProfile !== Attach` condition around Copy/Move/Duplicate in `useDialFileManager.ts`'s `actionLabels` computation.
2. Remove the placeholder comment and exhaustiveness-only `switch`; confirm exhaustiveness is still enforced by the new conditional's structure (or an explicit `switch`/lookup if the boolean form doesn't naturally preserve it — verify at implementation time).
3. Add regression tests (attach excludes Copy/Move/Duplicate, keeps Rename/Delete; standalone keeps the full matrix).
4. Update `openspec/specs/file-manager-tabs/spec.md` via this change's delta spec.

**Rollback**: revert the `actionProfile` condition — Copy/Move/Duplicate reappear in the attach modal, exactly as they behave today. No data or contract changes to revert.

## Open Questions

_None outstanding._ The two decisions that needed a call (D1's action scope, D2's profile naming) are resolved above with the reporter's confirmation on D1's core question (exclude Copy/Move/Duplicate from Attach).
