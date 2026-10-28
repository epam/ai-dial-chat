## MODIFIED Requirements

### Requirement: ConversationModule is registered in the root AppModule

`ConversationModule` (`apps/chat-api/src/conversations/conversation.module.ts`) SHALL be listed in the `imports` array of `apps/chat-api/src/app/app.module.ts`. It MUST import `UserConfigModule`, `ScheduledTaskUnreadModule`, `AppConfigModule`, and `DeploymentsModule`; declare `ConversationController` and `ConversationPublishController` in its `controllers` array; and provide the `ConversationService` facade plus `ConversationPersistenceService` (also bound to the `CONVERSATION_PERSISTENCE` token), `ConversationListingService`, `ConversationTitleCacheService`, `ConversationTitlesService`, `ConversationLifecycleService`, `ConversationStreamingService`, `ConversationNamingService`, `ConversationGenerationService`, `ConversationPublishService`, `ChatCompletionsAdapter`, `ResponsesAdapter`, `CoreResponsesClient`, and `BackgroundGenerationService`.

#### Scenario: Module is wired into the app

- **WHEN** the NestJS application bootstraps
- **THEN** `POST /api/v1/conversations` is reachable and returns a response (not 404)

### Requirement: Conversation list uses stored display name for writable items

`ConversationListingService.listConversations` SHALL return metadata without reading conversation bodies. It SHALL substitute a recently cached stored display name when available and SHALL mark an uncached or expired title with `isTitlePending: true`. Clients SHALL resolve pending titles through the bounded title endpoint after rendering the list.

The display-name resolution (`resolveListDisplayTitle`, also used by `getConversation`) SHALL treat a non-empty stored `name` as authoritative whenever `llmNamingDone === true`. A manual rename sets this marker. Otherwise the filename-derived title remains the fallback. The rule SHALL apply consistently to owned, published and shared entries without changing resource IDs.

#### Scenario: Cold listing completes independently of body latency

- **WHEN** metadata listing succeeds but individual conversation reads would remain unresolved
- **THEN** `GET /api/v1/conversations/list` returns metadata-derived titles and pending markers without starting or waiting for those reads

#### Scenario: Cached manually or LLM renamed title

- **GIVEN** an entry has a valid cached stored name and `llmNamingDone: true`
- **WHEN** its metadata is listed
- **THEN** its title uses the stored name and does not require another body read

#### Scenario: Older title converges with opening the conversation

- **GIVEN** an older conversation has an uncached renamed title
- **WHEN** the list is displayed and its background title batch succeeds
- **THEN** the list title equals the title returned by opening the conversation, even beyond the former twenty-item limit

#### Scenario: GET reflects manually-renamed display name when filename diverges

- **GIVEN** a manually renamed conversation whose filename still has its old title
- **WHEN** `GET /api/v1/conversations?path=...` is called
- **THEN** the returned display title is the authoritative stored name

## ADDED Requirements

### Requirement: Bounded conversation title projection endpoint

`POST /api/v1/conversations/titles` SHALL require the standard authenticated BFF session and accept a validated JSON body with 1–25 full conversation resource IDs. Its generated operation SHALL be `getConversationTitles`. It SHALL return HTTP 200 with `{ items: [{ id, title }] }` containing only successful projections and no conversation messages. Missing or inaccessible individual resources SHALL be omitted. Invalid IDs or batch sizes SHALL return 400; missing authentication SHALL return 401; upstream authentication failures SHALL not be hidden as successful titles. Batch-level upstream failures SHALL follow the existing 502/503 mapping.

#### Scenario: Exact encoded identity

- **WHEN** a permitted resource ID contains a literal percent escape represented as `%25` in its URL
- **THEN** the body request preserves that resource identity and does not decode it twice

#### Scenario: Partial missing resources

- **WHEN** one resource in a valid batch no longer exists
- **THEN** successful titles remain in the response and no title is invented for the missing item

#### Scenario: Invalid or oversized batch

- **WHEN** the request has more than 25 IDs, an empty array, a non-conversation resource, traversal, or control characters
- **THEN** validation rejects the request before any upstream reads

### Requirement: Bounded isolated title cache

Title caching SHALL store only title-resolution fields, use a finite size and five-minute expiry, and scope keys to a non-reversible digest of the caller's token plus exact resource identity. It SHALL coalesce concurrent equivalent reads. Successful saves, renames and LLM naming SHALL refresh or invalidate affected projections; deletion SHALL invalidate them. A prior in-flight read SHALL not overwrite a later successful write or delete.

#### Scenario: Identity isolation

- **WHEN** two different bearer tokens request the same resource ID
- **THEN** one token's cached title is not served from the other token's cache namespace

#### Scenario: Rename wins over earlier refresh

- **WHEN** a body read starts before a successful rename and completes after it
- **THEN** the cache retains the renamed title rather than the earlier fetched name

#### Scenario: Expiry or eviction

- **WHEN** a title's cache lifetime expires or capacity evicts it
- **THEN** metadata listing remains fast and marks it pending for a later bounded request
