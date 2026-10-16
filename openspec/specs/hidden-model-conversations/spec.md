# Spec: hidden-model-conversations

## Purpose

Define what a conversation can still do once the model it uses is hidden through `HIDDEN_ENTITY_TAGS`: the hidden model can no longer be sent to, shared or published, while the conversation itself stays readable and continues as soon as it is switched to a visible model ([GitHub issue #9183](https://github.com/epam/ai-dial-chat/issues/9183)). Duplicating such a conversation is covered by the `duplicate-conversation` spec.

## Requirements

### Requirement: The backend refuses to put a hidden model back to work

`assertModelNotHidden` (`apps/chat-api/src/conversations/utils/hidden-model.ts`) SHALL resolve a model id through `DeploymentsService.resolveDeploymentItem` and, when the deployment has `isHidden: true`, throw `ForbiddenException` with `code: conversationModelHidden` (`ConversationErrorCode.ModelHidden`, response DTO `ConversationModelHiddenErrorDto`). A model that resolves to no deployment, or no model id at all, is not refused. It SHALL be called:

- by `ConversationStreamingService.streamCompletion` with the request's `model` — the one selected now — before any generation starts, releasing the just-registered lease, so `POST /api/v1/conversations/completions` answers 403 and sends nothing to DIAL Core;
- by `ShareInvitationService.createShareLink` for a conversation, with the stored conversation's current model (`getConversationModelId`: `assistantModelId || model.id`), before `shareResource`;
- by `ConversationPublishService.publish` with the same current model, before `createPublication`.

#### Scenario: Sending to a hidden model is refused
- **WHEN** a completion is requested with a `model` whose deployment has `isHidden: true`
- **THEN** the response is 403 with `code: conversationModelHidden` and no completion request reaches DIAL Core

#### Scenario: A conversation switched to a visible model continues
- **GIVEN** a conversation that ran on a now-hidden model
- **WHEN** a completion is requested with a visible `model`
- **THEN** it streams normally

#### Scenario: Sharing or publishing a hidden-model conversation is refused
- **WHEN** a share link or a publication is requested for a conversation whose current model is hidden
- **THEN** the response is 403 with `code: conversationModelHidden` and nothing is shared or published

### Requirement: The composer blocks sending while the selected model is hidden

`ConversationView` SHALL treat a selected deployment with `isHidden: true` as unusable: the send button is disabled, the reply-to-selection action is off, and a `role="status"` notice with the `conversation.modelUnavailableNotice` translation key's text is shown above the composer. The model picker stays enabled, so selecting a visible model lifts the block.

#### Scenario: The open conversation's model is hidden
- **WHEN** the conversation's selected model is hidden
- **THEN** the send button is disabled and the notice asks the user to choose another model

### Requirement: The row menu offers no Share or Publish for a hidden-model conversation

The conversation row three-dot menu in `ConversationPanelView` SHALL omit Share and Publish under the same condition it omits Duplicate (see `duplicate-conversation`): for the open conversation, the model selected in its picker now; for any other row, the model in its resource path. Unpublish stays available, since it removes a copy rather than creating one.

#### Scenario: A hidden-model row offers no Share or Publish
- **WHEN** the user opens the three-dot menu of a row whose model deployment has `isHidden: true`
- **THEN** neither Share nor Publish is present
