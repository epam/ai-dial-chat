# message-rating Specification

## Purpose

Rating assistant messages: the BFF endpoint, the optimistic toggle, the negative-feedback modal, and read-only gating.
## Requirements

---

### Requirement: BFF rate endpoint

`POST /api/v1/rate` SHALL accept a JSON body with `conversationId`, `responseId`, `modelId`, a `rate` field, and an optional `comment`. `rate` SHALL be `1` (like), `-1` (dislike), or `null` (clear a previously sent rating). It SHALL proxy the rating to the DIAL Core endpoint `POST /v1/{modelId}/rate` using the authenticated session's access token as a Bearer credential and SHALL include `X-CONVERSATION-ID: <conversationId>` in that outbound BFF-to-DIAL-Core request, plus `X-JOB-TITLE` (`buildJobTitleHeaders(getJobTitleClaim(claims))`) when the session carries a job-title claim. On success it SHALL return HTTP 204 No Content. Invalid request bodies SHALL return HTTP 400.

`modelId` is `conversation.model.id` as set at conversation creation, which for a custom app or quick app is a multi-segment DIAL Core resource path (e.g. `applications/<bucket>/My%20App__1.0`) rather than a bare model id (e.g. `gpt-4o`). The BFF SHALL interpolate `modelId` into the outbound URL path **raw**, with no `encodeURIComponent` (or equivalent) applied to the whole string — matching how `@epam/ai-dial-typescript-sdk`'s own generated URL builders (e.g. `sendChatCompletionRequestUrl`) interpolate `deployment_name`. Encoding the entire string would turn a multi-segment id's literal `/` separators into `%2F` and 404 against DIAL Core, breaking rating for any conversation created against a custom app while leaving bare model ids (which contain no such characters) unaffected. `RateMessageDto.modelId` SHALL be validated with `@MaxLength(256)` and `@Matches(DEPLOYMENT_ID_PATTERN)` (the same allowlist regex used for `deploymentId` elsewhere, from `apps/chat-api/src/common/validators/deployment-id.pattern.ts`) so that a value flowing unencoded into a URL path stays constrained to safe characters.

The outbound JSON body sent to DIAL Core SHALL contain `{ responseId, rate: boolean }` and SHALL additionally include `comment` whenever the validated input contains a non-null comment. The BFF SHALL preserve the comment string exactly, including Unicode, whitespace, line breaks, and an explicitly empty string; absent or null comments SHALL be omitted from the outbound JSON. The body SHALL NOT include `conversationId` or `modelId`: `modelId` selects the URL path and `conversationId` drives the `X-CONVERSATION-ID` header. The BFF SHALL map the browser-facing `rate` value to DIAL Core's boolean as follows: `1` (like) maps to `rate: true`; `-1` (dislike) and `null` (clear) both map to `rate: false`, since DIAL Core has no third state to represent "cleared" separately from "disliked".

The BFF SHALL NOT discard `comment` because it is absent from DIAL Core's published `RateRequest` schema, or gate forwarding on the deployment's `supportCommentInRateResponse` feature. The published schema omits a field that Core explicitly handles. In Core commit `db16caa4`, when no `rateEndpoint` is configured, the original request body is passed to the analytics log store. When a `rateEndpoint` is configured, Core removes `comment` unless `supportCommentInRateResponse` is `true`, before forwarding the body and recording it in analytics. Restoring BFF forwarding therefore preserves the comment up to Core; its downstream retention remains Core's responsibility. This behavior is implemented in Core's `DeploymentFeatureController.handleRequestBody` and `HandleRateResponseFn.apply`, with forwarding/removal coverage in `FeaturesApiTest.testRateEndpointModel` and `testRateEndpointApplication`.

The generated `RateApi.rateMessage` method, authentication, authorization, rate limit, and cache behavior SHALL remain unchanged. This change introduces no UI, i18n, RTL, accessibility, feature-flag, or telemetry event changes.

#### Scenario: Valid rating returns 204

- **WHEN** an authenticated user sends `POST /api/v1/rate` with a valid body
- **THEN** the endpoint returns HTTP 204 with an empty body

#### Scenario: Rating forwards the conversation id header

- **WHEN** an authenticated user rates a message with `conversationId: "bucket/gpt-4o__Hello__uuid"`
- **THEN** the BFF calls `POST /v1/{modelId}/rate` with `X-CONVERSATION-ID: bucket/gpt-4o__Hello__uuid`

#### Scenario: Custom app deployment id preserves its path segments

- **WHEN** an authenticated user rates a message with `modelId: "applications/bucket/My%20App__1.0"`
- **THEN** the BFF calls `POST /v1/applications/bucket/My%20App__1.0/rate` on DIAL Core, with the literal `/` separators intact and no additional percent-encoding applied to the id

#### Scenario: Like forwards a boolean true to DIAL Core

- **WHEN** an authenticated user sends `POST /api/v1/rate` with `{ conversationId, responseId, modelId, rate: 1 }`
- **THEN** the BFF calls `POST /v1/{modelId}/rate` on DIAL Core with JSON body `{ responseId, rate: true }` and no `conversationId` or `modelId` property in that body

#### Scenario: Dislike forwards a boolean false to DIAL Core

- **WHEN** an authenticated user sends `POST /api/v1/rate` with `{ conversationId, responseId, modelId, rate: -1 }`
- **THEN** the BFF calls `POST /v1/{modelId}/rate` on DIAL Core with JSON body `{ responseId, rate: false }`

#### Scenario: Clearing a rating forwards a boolean false to DIAL Core

- **WHEN** an authenticated user sends `POST /api/v1/rate` with `{ conversationId, responseId, modelId, rate: null }`
- **THEN** the endpoint returns HTTP 204, and the BFF calls `POST /v1/{modelId}/rate` on DIAL Core with JSON body `{ responseId, rate: false }`

#### Scenario: Rating comment reaches DIAL Core unchanged

- **WHEN** an authenticated user sends `POST /api/v1/rate` with `{ conversationId, responseId, modelId, rate: -1, comment: "Too short" }`
- **THEN** the BFF calls `POST /v1/{modelId}/rate` with JSON body `{ responseId, rate: false, comment: "Too short" }`
- **AND** the endpoint returns HTTP 204 when Core succeeds
- **AND** the same comment-preservation rule applies to `rate: 1` and `rate: null`, including comments containing Unicode, whitespace, or line breaks
- **AND** the BFF forwards the comment regardless of the deployment's `supportCommentInRateResponse` feature, leaving downstream filtering to Core

#### Scenario: Explicitly empty comment is preserved

- **WHEN** a valid rating request contains `comment: ""`
- **THEN** the outbound JSON includes `comment: ""`

#### Scenario: Absent or null comment is omitted

- **WHEN** a valid rating request omits `comment` or supplies `comment: null`
- **THEN** the outbound JSON contains only `responseId` and the mapped boolean `rate`

#### Scenario: Missing required field returns 400

- **WHEN** `modelId` (or any other required field) is absent from the body
- **THEN** the endpoint returns HTTP 400

#### Scenario: Invalid rate value returns 400

- **WHEN** `rate` is a value other than `1`, `-1`, or `null`
- **THEN** the endpoint returns HTTP 400

#### Scenario: modelId with characters outside the deployment-id allowlist returns 400

- **WHEN** `modelId` contains a character not permitted by `DEPLOYMENT_ID_PATTERN` (or exceeds 256 characters)
- **THEN** the endpoint returns HTTP 400

#### Scenario: DIAL Core error is propagated

- **WHEN** the DIAL Core rating endpoint returns a non-2xx status
- **THEN** the BFF returns an appropriate HTTP error (502 or 503)

### Requirement: Generated rate API client

The rate endpoint SHALL be included in `libs/chat-api-client/openapi.json` and SHALL generate a `RateApi` class with a `rateMessage` method accepting `RateMessageDto`. The app configures one instance, `rateApi = new RateApi(config)`, in `apps/chat/src/server-api/api-client.ts`; there is no `rate.api.ts` wrapper. The host pages (`ConversationPage`, `AppPreviewChat`) pass that instance as `rateApi` into `useConversationHandlers` from `libs/chat-hooks`, which calls `rateApi.rateMessage({ rateMessageDto })` itself. No handwritten `base.ts` `post` helper is used.

#### Scenario: Generated client exposes rateMessage

- **WHEN** `npm run openapi` is run after the BFF rate endpoint is added
- **THEN** `libs/chat-api-client/src/generated/src/apis/RateApi.ts` contains `rateMessage({ rateMessageDto })`

#### Scenario: The chat-hooks handler calls the injected client

- **WHEN** `handleRateMessage` from `useConversationHandlers` rates a message
- **THEN** it calls `rateApi.rateMessage({ rateMessageDto: { conversationId, responseId, modelId, rate, comment? } })` on the instance the host page passed in

#### Scenario: Legacy base endpoint is not extended

- **WHEN** the frontend rates a message
- **THEN** `apps/chat/src/server-api/base.ts` has no `RATE` endpoint constant for `/api/v1/rate`

---

### Requirement: `rating` field on `Message`

The `Message` interface in `libs/chat-shared` SHALL include an optional `rating?: MessageRating` field where `MessageRating` is a numeric enum: `Like = 1`, `Dislike = -1`. This value is the signed integer DIAL Core adds to the message's running like count. The field is kept in local conversation state and persisted to the server after each successful rate action.

#### Scenario: Message without a rating

- **WHEN** a `Message` object is created without a `rating` field
- **THEN** `rating` is `undefined` and no type error is raised

#### Scenario: Message with a like rating

- **WHEN** `rating: MessageRating.Like` is set on a `Message` object
- **THEN** the type is valid and the field value is `1`

#### Scenario: Message with a dislike rating

- **WHEN** `rating: MessageRating.Dislike` is set on a `Message` object
- **THEN** the type is valid and the field value is `-1`

---

### Requirement: Active rating state in MessageActions

The `MessageActions` component SHALL accept an optional `activeRating?: MessageRating` prop. When `activeRating` matches a button (`Like = 1` or `Dislike = -1`), that button SHALL be visually highlighted. Clicking a highlighted button SHALL fire its callback anyway — toggle logic is the parent's responsibility.

#### Scenario: Like button highlighted when activeRating is Like (1)

- **WHEN** `MessageActions` is rendered with `activeRating={MessageRating.Like}`
- **THEN** the Like button carries a visual active indicator (accent-colored icon)

#### Scenario: Dislike button highlighted when activeRating is Dislike (-1)

- **WHEN** `MessageActions` is rendered with `activeRating={MessageRating.Dislike}`
- **THEN** the Dislike button carries a visual active indicator

#### Scenario: No button highlighted when activeRating is undefined

- **WHEN** `MessageActions` is rendered without `activeRating`
- **THEN** neither Like nor Dislike button shows an active indicator

---

### Requirement: Optimistic rating toggle in ConversationPage

When the user clicks Like or Dislike on an assistant message in a read-write conversation, `handleRateMessage(messageIndex, rating, comment?)` from `useConversationHandlers` (`libs/chat-hooks`) SHALL:

1. Immediately update `message.rating` in local state (optimistic update).
2. Fire `POST /api/v1/rate` with the new rating value: `1` or `-1` for a fresh Like/Dislike, `null` when the user clicked the currently-active button (toggling it off). An empty `comment` is dropped from the request (`...(comment ? { comment } : {})`).
3. On success, persist the updated conversation via `conversationsApi.saveConversation`.
4. If the message has no `responseId`, or the API call or the save fails, revert the optimistic update.

It resolves to `true` on success and `false` otherwise. The host pages (`ConversationPage`, `AppPreviewChat`) only wrap it to show the success toasts. In read-only conversations, the Like and Dislike buttons SHALL NOT be rendered.

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

---

### Requirement: Negative feedback modal

When the user clicks Dislike on an assistant message that is **not already disliked** in a read-write conversation, the host page SHALL open a `NegativeFeedbackModal` instead of immediately calling the rate API. The modal collects a required feedback category and an optional free-text comment before the rating is submitted. This applies to every host that renders `ConversationView` with rating enabled — both `apps/chat/src/pages/Conversation/Conversation.tsx` (`ConversationPage`) and the App Editor's `apps/chat/src/pages/ApplicationEditor/setup/AppPreviewChat.tsx` (preview chat) SHALL wire `onDislikeMessage` to open the modal rather than rating immediately, so the preview's rating UX has no reduced functionality relative to a normal conversation.

In read-only conversations, the Dislike button is not rendered, so the modal cannot be triggered.

**Component:** `apps/chat/src/components/ConversationView/Rate/NegativeFeedbackModal.tsx`

**State:** each host page holds `pendingDislikeMessageIndex: number | null` (same pattern as `pendingDeleteIndex`). On submit it calls the chat-hooks `handleRateMessage(index, MessageRating.Dislike, comment)`, whose signature is `(messageIndex: number, rating: MessageRating | null, comment?: string) => Promise<boolean>` and which forwards `comment` to `rateApi.rateMessage`.

**Modal contents:**
- Title: **"Send negative feedback"**
- Required `Select` labelled **"What type of feedback you want to give? \*"** with the following options defined in `apps/chat/src/constants/feedback-categories.ts`:
  - "UI bug"
  - "Overactive refusal"
  - "Incomplete response"
  - "Should have triggered thinking"
  - "Should have searched the web"
- Optional `Textarea` with placeholder **"Type an optional comment to your feedback"**, rendered only when the `OverlayFeature.DislikeComment` UI feature is enabled (it is in the default feature list)
- A **"Send"** button (`ButtonsI18nKeys.Send`) supplied as a 2.0 `Popup` `mainButtons` entry with `ButtonVariant.Primary` — disabled until a category is selected
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

#### Scenario: App Editor preview chat opens the same modal on Dislike

- **WHEN** the user clicks Dislike on an assistant message in the App Editor's preview chat (`AppPreviewChat`)
- **THEN** the `NegativeFeedbackModal` opens and no API call is made, matching `ConversationPage`'s behavior

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

---

### Requirement: Rating toast notifications

After a successful Like toggle-on or a successful negative feedback submission, the host page (`ConversationPage` and `AppPreviewChat`) SHALL show a success notification confirming the rating was received. The notification SHALL NOT appear when a rating is toggled off or when the API call fails.

**Mechanism:** there is no dedicated rating toast component. The host calls `showSuccessNotification` from `NotificationContext` (`useNotification`) when `handleRateMessage` resolves `true`; the shared `NotificationContainer` renders it and dismisses it after `DISMISS_DELAY_MS = 5000`.

**Toast copy** (`RateI18nKeys`, `rate.*` in `en.json`):
- Like: title `RateI18nKeys.LikeToastTitle` ("Thank you for your positive feedback!"), message `RateI18nKeys.LikeToastDescription` ("You help us make better products").
- Negative feedback: title `RateI18nKeys.DislikeToastTitle` ("Thank you for letting us know about this issue"), message `RateI18nKeys.LikeToastDescription`.

#### Scenario: Successful Like shows a success toast

- **WHEN** the user clicks Like and the API call succeeds
- **THEN** a floating success toast appears and auto-dismisses after 5 000 ms

#### Scenario: Successful feedback submission shows a success toast

- **WHEN** the user submits the `NegativeFeedbackModal` and the API call succeeds
- **THEN** a floating success toast appears and auto-dismisses after 5 000 ms

#### Scenario: Toggling off a rating shows no toast

- **WHEN** the user clicks the active Like or Dislike button to deselect it
- **THEN** no toast is displayed

#### Scenario: API failure shows no toast

- **WHEN** the rate API call fails for any reason
- **THEN** no toast is displayed (the optimistic UI revert serves as the error signal)

#### Scenario: Rapid successive ratings each add a notification

- **WHEN** the user triggers two rating successes within 5 000 ms of each other
- **THEN** each success adds its own notification, and each auto-dismisses 5 000 ms after it appears

---

### Requirement: Message rating actions disabled in read-only conversations

All message rating UI and interactions SHALL be suppressed when viewing a read-only conversation. The conversation is read-only when the `isReadonly` flag is set on the conversation list item, or when the user lacks WRITE permission on the resource. Independently of read-only state, `ConversationMessageItem` also hides Like and Dislike when the `OverlayFeature.Likes` UI feature is disabled.

#### Scenario: Rating buttons hidden in read-only conversation

- **WHEN** a conversation is read-only
- **THEN** Like and Dislike buttons are not rendered on any assistant message in the conversation view
- **AND** the user cannot interact with any rating feature
