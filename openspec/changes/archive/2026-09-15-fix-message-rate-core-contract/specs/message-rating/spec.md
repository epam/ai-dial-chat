## MODIFIED Requirements

### Requirement: BFF rate endpoint

`POST /api/v1/rate` SHALL accept a JSON body with `conversationId`, `responseId`, `modelId`, a `rate` field, and an optional `comment`. `rate` SHALL be `1` (like), `-1` (dislike), or `null` (clear a previously sent rating). It SHALL proxy the rating to the DIAL Core endpoint `POST /v1/{modelId}/rate` using the authenticated session's access token as a Bearer credential and SHALL include `X-CONVERSATION-ID: <conversationId>` in that outbound BFF-to-DIAL-Core request. On success it SHALL return HTTP 204 No Content. Invalid request bodies SHALL return HTTP 400.

The outbound JSON body sent to DIAL Core SHALL conform exactly to DIAL Core's own `RateRequest` schema — `{ responseId, rate: boolean }` — and SHALL NOT include `conversationId` or `modelId` as body fields (DIAL Core has no such properties on `RateRequest`; `modelId` selects the URL path segment and `conversationId` drives the `X-CONVERSATION-ID` header only). The BFF SHALL map the browser-facing `rate` value to DIAL Core's boolean as follows: `1` (like) maps to `rate: true`; `-1` (dislike) and `null` (clear) both map to `rate: false`, since DIAL Core has no third state to represent "cleared" separately from "disliked".

The generated `RateApi.rateMessage` method, authentication, authorization, rate limit, and cache behavior SHALL remain unchanged. This change introduces no UI, i18n, RTL, accessibility, feature-flag, or telemetry event changes.

#### Scenario: Valid rating returns 204

- **WHEN** an authenticated user sends `POST /api/v1/rate` with a valid body
- **THEN** the endpoint returns HTTP 204 with an empty body

#### Scenario: Rating forwards the conversation id header

- **WHEN** an authenticated user rates a message with `conversationId: "bucket/gpt-4o__Hello__uuid"`
- **THEN** the BFF calls `POST /v1/{modelId}/rate` with `X-CONVERSATION-ID: bucket/gpt-4o__Hello__uuid`

#### Scenario: Like forwards a boolean true to DIAL Core

- **WHEN** an authenticated user sends `POST /api/v1/rate` with `{ conversationId, responseId, modelId, rate: 1 }`
- **THEN** the BFF calls `POST /v1/{modelId}/rate` on DIAL Core with JSON body `{ responseId, rate: true }` and no `conversationId` or `modelId` property in that body

#### Scenario: Dislike forwards a boolean false to DIAL Core

- **WHEN** an authenticated user sends `POST /api/v1/rate` with `{ conversationId, responseId, modelId, rate: -1 }`
- **THEN** the BFF calls `POST /v1/{modelId}/rate` on DIAL Core with JSON body `{ responseId, rate: false }`

#### Scenario: Clearing a rating forwards a boolean false to DIAL Core

- **WHEN** an authenticated user sends `POST /api/v1/rate` with `{ conversationId, responseId, modelId, rate: null }`
- **THEN** the endpoint returns HTTP 204, and the BFF calls `POST /v1/{modelId}/rate` on DIAL Core with JSON body `{ responseId, rate: false }`

#### Scenario: Missing required field returns 400

- **WHEN** `modelId` (or any other required field) is absent from the body
- **THEN** the endpoint returns HTTP 400

#### Scenario: Invalid rate value returns 400

- **WHEN** `rate` is a value other than `1`, `-1`, or `null`
- **THEN** the endpoint returns HTTP 400

#### Scenario: DIAL Core error is propagated

- **WHEN** the DIAL Core rating endpoint returns a non-2xx status
- **THEN** the BFF returns an appropriate HTTP error (502 or 503)

### Requirement: Optimistic rating toggle in ConversationPage

When the user clicks Like or Dislike on an assistant message in a read-write conversation, the `ConversationPage` SHALL:

1. Immediately update `message.rating` in local state (optimistic update).
2. Fire `POST /api/v1/rate` with the new rating value: `1` or `-1` for a fresh Like/Dislike, `null` when the user clicked the currently-active button (toggling it off).
3. On success, persist the updated conversation via `saveConversation`.
4. If the API call or the save fails, revert the optimistic update.

In read-only conversations, the Like and Dislike buttons SHALL NOT be rendered.

#### Scenario: Clicking Like sets rating to 1

- **WHEN** the user clicks the Like button on an assistant message with no current rating
- **THEN** the Like button becomes active, the API is called with `rate: 1`, and the conversation is saved

#### Scenario: Clicking Like again deselects the rating and notifies DIAL Core

- **WHEN** the user clicks the Like button on a message already rated Like
- **THEN** the Like button becomes inactive, `POST /api/v1/rate` is called with `rate: null`, and — once that call succeeds — the conversation is saved with `rating: undefined`

#### Scenario: Clicking Dislike again deselects the rating and notifies DIAL Core

- **WHEN** the user clicks the Dislike button on a message already rated Dislike
- **THEN** the Dislike button becomes inactive, `POST /api/v1/rate` is called with `rate: null`, and — once that call succeeds — the conversation is saved with `rating: undefined`

#### Scenario: Switching from Like to Dislike

- **WHEN** the user clicks Dislike on a message already rated Like
- **THEN** the Dislike button becomes active, the Like button becomes inactive, and the API is called once with `rate: -1` (no separate clear call for the prior Like)

#### Scenario: API failure reverts optimistic update

- **WHEN** the API call to `POST /api/v1/rate` fails, including a clear (`rate: null`) call
- **THEN** `message.rating` is restored to its value before the click and the conversation is not saved

#### Scenario: Save failure reverts optimistic update

- **WHEN** `saveConversation` fails after a successful rate API call
- **THEN** `message.rating` is restored to its value before the click

#### Scenario: Rating buttons hidden in read-only conversation

- **WHEN** the conversation is read-only (isReadonly flag set or user lacks WRITE permission)
- **THEN** the Like and Dislike buttons are not rendered on any assistant message
- **AND** the user cannot trigger a rating change

### Requirement: Negative feedback modal

When the user clicks Dislike on an assistant message that is **not already disliked** in a read-write conversation, the `ConversationPage` SHALL open a `NegativeFeedbackModal` instead of immediately calling the rate API. The modal collects a required feedback category and an optional free-text comment before the rating is submitted.

In read-only conversations, the Dislike button is not rendered, so the modal cannot be triggered.

**Component:** `apps/chat/src/components/ConversationView/NegativeFeedbackModal.tsx`

**State:** `ConversationPage` holds `pendingDislikeMessageIndex: number | null` (same pattern as `pendingDeleteIndex`). `handleRateMessage` signature MUST be extended to `(messageIndex: number, rating: MessageRating | null, comment?: string)`, forwarding `comment` to `rateMessage`.

**Modal contents:**

- Title: **"Send negative feedback"**
- Required `Select` labelled **"What type of feedback you want to give? \*"** with the following options defined in `apps/chat/src/constants/feedback-categories.ts`:
  - "UI bug"
  - "Overactive refusal"
  - "Incomplete response"
  - "Should have triggered thinking"
  - "Should have search the web"
- Optional `Textarea` with placeholder **"Type an optional comment to your feedback"**
- `PrimaryButton` labelled **"Send"** — disabled until a category is selected
- Close (×) icon button

**Comment encoding:** On submit, category and comment are combined as `"${category}: ${comment}"` when both are present, or just `"${category}"` when no comment is entered. This combined string is passed as the `comment` field of `POST /api/v1/rate`. No new backend fields are required.

**Prop threading:**

- `ConversationView` gains `onDislikeMessage?: (messageIndex: number) => void`
- `build-message-actions.ts` `MessageActionHandlers` gains `onDislike?: (messageIndex: number) => void`; for Dislike clicks when `msg.rating !== MessageRating.Dislike`, it calls `handlers.onDislike(index)` instead of `handlers.onRate(index, Dislike)`
- Like continues to call `handlers.onRate` directly without a modal

#### Scenario: Clicking Dislike on an unrated message opens the modal

- **WHEN** the user clicks Dislike on an assistant message with no current rating
- **THEN** the `NegativeFeedbackModal` opens and no API call is made

#### Scenario: Clicking Dislike on a Like-rated message opens the modal

- **WHEN** the user clicks Dislike on an assistant message currently rated Like
- **THEN** the `NegativeFeedbackModal` opens and no API call is made yet

#### Scenario: Submit with category and comment sends combined string

- **WHEN** the user selects a category and enters comment text then clicks Send
- **THEN** `POST /api/v1/rate` is called with `rate: -1` and `comment: "<category>: <text>"`, and the modal closes

#### Scenario: Submit with category only sends category string

- **WHEN** the user selects a category and leaves the textarea empty then clicks Send
- **THEN** `POST /api/v1/rate` is called with `rate: -1` and `comment: "<category>"` (no trailing colon or space)

#### Scenario: Send button is disabled until a category is selected

- **WHEN** the modal opens and no category has been selected
- **THEN** the Send button is disabled and cannot be clicked

#### Scenario: Dismissing the modal cancels the rating

- **WHEN** the user closes the modal via the × button or click-outside without clicking Send
- **THEN** no API call is made and `message.rating` remains unchanged

#### Scenario: Clicking Dislike on an already-disliked message clears it and notifies DIAL Core

- **WHEN** the user clicks Dislike on a message whose `rating` is `MessageRating.Dislike`
- **THEN** the modal does NOT open; `POST /api/v1/rate` is called with `rate: null`, and — once that call succeeds — `message.rating` is cleared to `undefined` and the conversation is saved

#### Scenario: API failure after modal submit reverts optimistic update

- **WHEN** `POST /api/v1/rate` fails after the user submits the modal
- **THEN** `message.rating` is restored to its value before the click
