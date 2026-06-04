## Context

The conversation panel displays conversations in three source-based tabs: **My chats**, **Shared**, and **Organization**. The panel library (`libs/conversation-panel`) already models this via `ConversationSource` enum and the `matchesTab` filter — it is fully implemented and correct.

The gap is in the data pipeline: DIAL Core returns `sharedWithMe` and `publishedWithMe` boolean flags on each listing item, but the NestJS service casts the response to a narrow type that omits these fields, so they never reach the frontend.

**Current flow:**
```
DIAL Core → [sharedWithMe/publishedWithMe dropped by type cast] → ConversationListItemDto (id, title, updatedAt) → ConversationPanelView (no source set) → all tabs empty except "All"
```

**Target flow:**
```
DIAL Core → [flags preserved] → ConversationListItemDto (+ sharedWithMe, publishedWithMe) → ConversationPanelView (maps to ConversationSource) → tabs filter correctly
```

Investigation reference: `docs/conversation-filtering-investigation.md` and `development` branch (`apps/chat/src/utils/app/search.ts`).

## Goals / Non-Goals

**Goals:**
- Preserve `sharedWithMe` and `publishedWithMe` from the DIAL Core listing response
- Expose them on the backend DTO and regenerated API client
- Map them to `ConversationSource` in the frontend adapter
- Enable "My chats", "Shared", and "Organization" tabs to filter correctly

**Non-Goals:**
- Changes to `libs/conversation-panel` (model and filter logic are already correct)
- Pagination of the conversations list (separate concern)
- Pinning / `isPinned` mapping (separate concern)
- Any UI design changes to the filter tabs themselves

## Decisions

### Decision: Preserve flags via type cast extension, not SDK type change

The DIAL Core SDK type for `getConversationMetadata` items does not include `sharedWithMe`/`publishedWithMe` in its TypeScript declaration, but DIAL Core does return them at runtime. Rather than patching the SDK, we widen the local type cast in `conversation.service.ts` to include the two optional boolean fields.

**Why**: The SDK is an external dependency managed independently. A local cast extension is the minimal, reversible change and stays within our control. When the SDK type is eventually updated upstream, the cast can be narrowed back.

**Alternative considered**: Add a custom runtime response interceptor to extract arbitrary fields — rejected as over-engineering for two simple flags.

### Decision: Map to ConversationSource in the app adapter, not the backend DTO

`ConversationSource` is a lib-level concept (`libs/conversation-panel`). The backend DTO remains framework-neutral (two raw booleans). The mapping from `{sharedWithMe, publishedWithMe}` → `ConversationSource` lives in `ConversationPanelView.tsx` (the app-level adapter).

**Why**: Libs must not know about app/backend integration details. The backend DTO should be a clean data contract, not coupled to a frontend enum. The adapter layer is the correct place for this translation.

### Decision: Default unmapped items to ConversationSource.MyChats

An item where both flags are `false` (or absent) belongs to the current user — it is a "my chat". This mirrors the logic in the `development` branch: `!sharedWithMe && !publishedWithMe` → my item.

## Risks / Trade-offs

- **[Risk] DIAL Core does not return flags for all environments** → Flags default to `false` (absent = own item), which maps to `MyChats`. Worst case: shared/org conversations appear in "My chats" rather than disappearing. Mitigation: test against the target environment before shipping.

- **[Risk] Client regeneration breaks other consumers** → The new fields are additive (optional booleans). Existing frontend code that destructures only `id`/`title`/`updatedAt` is unaffected. Mitigation: run typecheck and affected tests after regeneration.

- **[Trade-off] sharedWithMe/publishedWithMe naming is specific to one DIAL Core version** → If DIAL Core renames these fields, the type cast and DTO must be updated. Acceptable given we own the backend and can track SDK changelogs.

## Migration Plan

1. Update `conversation.service.ts` (type cast + item mapping)
2. Update `ConversationListItemDto` (add two `@ApiProperty` boolean fields)
3. Regenerate `libs/chat-api-client` using existing repo OpenAPI scripts
4. Update `ConversationPanelView.tsx` to set `source` on each item
5. Verify filter tabs in browser against DIAL Core test environment
6. Remove temporary debug `console.log` from `ConversationsContext.tsx` and `conversation.service.ts`

Rollback: revert the four file changes; no database or infrastructure changes involved.
