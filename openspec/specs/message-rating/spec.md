## Requirements

---

### Requirement: BFF rate endpoint

`POST /api/v1/rate` SHALL accept a JSON body with `conversationId`, `responseId`, `modelId`, and `rate` (`1` for like, `-1` for dislike), plus an optional `comment`. It SHALL proxy the rating to the DIAL Core endpoint `POST /v1/{modelId}/rate` using the authenticated session's access token as a Bearer credential. On success it SHALL return HTTP 204 No Content. Invalid request bodies SHALL return HTTP 400.

#### Scenario: Valid rating returns 204

- **WHEN** an authenticated user sends `POST /api/v1/rate` with a valid body
- **THEN** the endpoint returns HTTP 204 with an empty body

#### Scenario: Missing required field returns 400

- **WHEN** `modelId` (or any other required field) is absent from the body
- **THEN** the endpoint returns HTTP 400

#### Scenario: Invalid rate value returns 400

- **WHEN** `rate` is a value other than `1` or `-1`
- **THEN** the endpoint returns HTTP 400

#### Scenario: DIAL Core error is propagated

- **WHEN** the DIAL Core rating endpoint returns a non-2xx status
- **THEN** the BFF returns an appropriate HTTP error (502 or 503)

---

### Requirement: Generated rate API client

The rate endpoint SHALL be included in `libs/chat-api-client/openapi.json` and SHALL generate a `RateApi` class with a `rateMessage` method accepting `RateMessageDto`. Frontend code SHALL call `POST /api/v1/rate` through an `apps/chat/src/server-api/rate.api.ts` wrapper that delegates to the generated `RateApi`, not through handwritten `base.ts` `post` helpers.

#### Scenario: Generated client exposes rateMessage

- **WHEN** `npm run openapi` is run after the BFF rate endpoint is added
- **THEN** `libs/chat-api-client/src/generated/src/apis/RateApi.ts` contains `rateMessage({ rateMessageDto })`

#### Scenario: Frontend wrapper delegates to generated client

- **WHEN** `rateMessage(body)` is called from `apps/chat/src/server-api/rate.api.ts`
- **THEN** it calls `rateApi.rateMessage({ rateMessageDto: body })`

#### Scenario: Legacy base endpoint is not extended

- **WHEN** the frontend rate wrapper is implemented
- **THEN** `apps/chat/src/server-api/base.ts` does not gain a new `RATE` endpoint constant for `/api/v1/rate`

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

When the user clicks Like or Dislike on an assistant message, the `ConversationPage` SHALL:
1. Immediately update `message.rating` in local state (optimistic update).
2. Fire `POST /api/v1/rate` with the new numeric rating (`1` or `-1`).
3. On success, persist the updated conversation via `saveConversation`.
4. If the API call or save fails, revert the optimistic update.
5. If the user clicks the currently-active button, set `rating` to `undefined` (toggle off), skip the API call, and persist the cleared state.

#### Scenario: Clicking Like sets rating to 1

- **WHEN** the user clicks the Like button on an assistant message with no current rating
- **THEN** the Like button becomes active, the API is called with `rate: 1`, and the conversation is saved

#### Scenario: Clicking Like again deselects the rating

- **WHEN** the user clicks the Like button on a message already rated Like
- **THEN** the Like button becomes inactive, no API call is made, and the conversation is saved with `rating: undefined`

#### Scenario: Switching from Like to Dislike

- **WHEN** the user clicks Dislike on a message already rated Like
- **THEN** the Dislike button becomes active, the Like button becomes inactive, and the API is called with `rate: -1`

#### Scenario: API failure reverts optimistic update

- **WHEN** the API call to `POST /api/v1/rate` fails
- **THEN** `message.rating` is restored to its value before the click

#### Scenario: Save failure reverts optimistic update

- **WHEN** `saveConversation` fails after a successful rate API call
- **THEN** `message.rating` is restored to its value before the click
