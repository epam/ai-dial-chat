## Context

The Save & Submit button appears in both `UserMessage.tsx` and `AssistantMessage.tsx` components when a message is being edited. Currently, the button has no tooltip, but it can be disabled for several reasons:

- Files are uploading (needs to wait)
- Message content is empty (needs to type something)
- Transcription is in progress (user messages only)

The Send button in `SendMessageButton.tsx` already implements comprehensive tooltips that explain why it's disabled and what action the user should take. The Send button's tooltip logic lives in `ChatInputMessage.tsx` and generates context-aware messages for each disable scenario.

**Current button patterns:**
- Send button: Uses `DialButton` with conditional `tooltipProps` (hideTooltip logic)
- Save & Submit button: Uses `DialPrimaryButton` with no tooltip

## Goals / Non-Goals

**Goals:**
- Add tooltip support to Save & Submit buttons in UserMessage and AssistantMessage components
- Show helpful context when button is disabled (file uploading, empty content, transcription pending)
- Hide tooltip when button is enabled and ready to submit
- Follow the same tooltip pattern and styling as the existing Send button
- Mirror the user experience: same conditions, same helpful messages

**Non-Goals:**
- Changing the disable conditions or button behavior
- Creating new disable states or validation rules
- Adding tooltips to other message edit buttons (delete, regenerate, etc.)
- Refactoring the Send button's tooltip implementation
- Adding feature flags or A/B testing for tooltips

## Decisions

### Decision 1: Inline tooltip generation vs. shared helper

**Chosen approach: Inline tooltip generation in each component**

**Rationale:**
- UserMessage and AssistantMessage have slightly different disable conditions (user has transcription, assistant doesn't)
- Tooltip messages differ slightly: "Please type message" vs. appropriate text for assistant edits
- Inline keeps the logic close to the button and easy to modify per component
- Reduces over-engineering for two similar but distinct cases

**Alternative considered:**
- Create a shared `generateEditTooltip(disabledReason)` helper function — more maintainable long-term but adds indirection for minimal code reuse

### Decision 2: Use DialPrimaryButton's tooltipProps vs. creating a wrapper

**Chosen approach: Add tooltipProps directly to DialPrimaryButton**

**Rationale:**
- DialPrimaryButton (from ui-kit) already supports tooltipProps like DialButton does
- Consistent with existing button patterns in the codebase
- No need for a wrapper component or refactoring

### Decision 3: Tooltip content and disable condition mapping

**Chosen approach: Map each disable condition to a specific tooltip message**

**Tooltip scenarios:**
- `isUploadingAttachmentPresent` → "Wait for attachment to load"
- `isContentEmptyAndNoAttachments` → "Please type message"
- `isUserMessageTranscribing` (user messages only) → "Wait for transcription to complete"
- Button enabled → Hide tooltip (via `hideTooltip: true`)

**Rationale:**
- Mirrors the Send button's context-aware messaging
- Clear and actionable messages tell users exactly what they need to do
- Order matters: check upload first, then empty, then transcription (same priority as disable logic)

### Decision 4: i18n for tooltip strings

**Chosen approach: Use ChatI18nKeys for tooltip strings**

**Rationale:**
- Consistent with existing tooltip strings in MessageButtons.tsx and SendMessageButton.tsx
- Already translated via i18n infrastructure
- Follows codebase conventions

**i18n keys to add (if not already present):**
- May reuse existing keys like `waitForAttachmentToLoad`, `pleaseTypeMessage`
- Or create new keys if exact wording differs for edit context

## Risks / Trade-offs

### Risk: Tooltip behavior differs slightly between Send and Save buttons

**Mitigation:**
- Keep tooltip messaging consistent with Send button when possible
- Test both buttons in the same edit scenarios to ensure parallel behavior
- Document in a comment why any differences exist (e.g., transcription only on user messages)

### Risk: DialPrimaryButton may not support tooltipProps

**Mitigation:**
- Verify ui-kit version supports tooltipProps before implementation
- If not, consider using DialButton wrapper or ui-kit upgrade

### Risk: Multiple disable conditions might be true simultaneously

**Mitigation:**
- Implement tooltip priority: upload first, then empty content, then transcription
- Show the most actionable message (what the user should fix first)
- This is already the order in the disabled check, so keep it consistent

## Migration Plan

**Deployment:**
1. Update `UserMessage.tsx`: Add tooltip generation logic and tooltipProps to Save & Submit button
2. Update `AssistantMessage.tsx`: Add tooltip generation logic and tooltipProps to Save & Submit button
3. Add i18n keys if needed (or verify existing ones cover all messages)
4. Test in development: Edit user and assistant messages, verify tooltips appear/disappear correctly
5. Merge as non-breaking change (tooltip is additive, no behavior change)

**Rollback:**
- Remove tooltipProps from both components (simple revert)
- No data migration or state changes needed

## Open Questions

1. Should tooltip positioning be configurable (top, bottom, left, right) or use DialPrimaryButton's default?
   - Suggestion: Use default (likely 'top' to match other buttons)

2. Are there additional disable scenarios to consider (quota limits, conversation locked, etc.)?
   - Clarify with design/UX team before implementation

3. Does the tooltip for empty content need different wording for assistant edits vs. user edits?
   - Suggestion: Keep consistent ("Please type message" or similar)
