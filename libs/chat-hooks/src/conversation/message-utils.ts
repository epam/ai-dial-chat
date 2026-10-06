import {
  type DeploymentConfigurationSchema,
  type DeploymentConfigurationSchemaProperty,
  Message,
  MessageRole,
  ResponseFormat,
  StatusEvent,
  isStatusMessage,
} from '@epam/ai-dial-chat-shared';

/**
 * Returns `true` when `message` is the actively-streaming assistant response.
 * Only the last message in the list can be streaming, and only while
 * `isAssistantTyping` is `true`.
 */
export const isMessageStreaming = (
  message: Message,
  messageIndex: number,
  totalMessages: number,
  isAssistantTyping: boolean,
): boolean =>
  isAssistantTyping &&
  messageIndex === totalMessages - 1 &&
  message.role === MessageRole.Assistant;

/**
 * Returns the deployment the conversation was last running on: scanning
 * backwards, the `new_deployment_id` of a `model_changed` status message or
 * the `deploymentId` a message carries in its own right, whichever comes
 * later. `null` when neither is present.
 *
 * Reading only the status messages loses the switch whenever a regenerate or
 * an edit truncates past one: the marker is appended at the end of the
 * timeline, so truncating at an earlier message drops it, and the model the
 * user picked reverted on the next page load even though the answer had been
 * regenerated on it ([#8712](https://github.com/epam/ai-dial-chat/issues/8712)). The assistant message the backend writes
 * carries the deployment that produced it, which survives that truncation
 * because it *is* the regenerated message.
 */
export const getLastDeploymentId = (messages: Message[]): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      isStatusMessage(msg) &&
      msg.custom_content?.event_type === StatusEvent.ModelChanged
    ) {
      return msg.custom_content.new_deployment_id;
    }
    if (msg.deploymentId) return msg.deploymentId;
  }
  return null;
};

/** True when `message` is an assistant message carrying at least one stage. */
export const messageHasStages = (message: Message): boolean =>
  message.role === MessageRole.Assistant &&
  (message.custom_content?.stages?.length ?? 0) > 0;

/**
 * Returns the `configuration_value` stored on the last user message, or
 * `undefined` if none exists. Used to restore the tools menu toggle state
 * when a conversation is (re-)loaded, mirroring `getLastDeploymentId`.
 */
export const getLastUserMessageToolConfiguration = (
  messages: Message[],
): Record<string, unknown> | undefined => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MessageRole.User) {
      return messages[i].custom_content?.configuration_value;
    }
  }
  return undefined;
};

/*
 * Resolves the boolean a `form_schema` property carries. `default` is the
 * JSON-Schema-native current value, so it wins. A `oneOf` is accepted only
 * with a single entry: with several `{ const }` options nothing says which
 * one is selected.
 */
const resolveFormSchemaBoolean = (
  property: DeploymentConfigurationSchemaProperty,
): boolean | undefined => {
  if (typeof property.default === 'boolean') return property.default;
  const oneOf = property.oneOf;
  if (Array.isArray(oneOf) && oneOf.length === 1) {
    const option: unknown = oneOf[0];
    if (
      typeof option === 'object' &&
      option !== null &&
      'const' in option &&
      typeof option.const === 'boolean'
    ) {
      return option.const;
    }
  }
  return undefined;
};

/**
 * Returns the boolean values an assistant message's `form_schema` sets, keyed
 * by property name, or `undefined` when no property resolves to a boolean.
 * Lets a DIAL app switch a tools-menu toggle (e.g. `deep_research`) per
 * message — on while a run is in progress, off once its result is delivered.
 * Not filtered by tool id: `restoreToolConfiguration` ignores unknown ids.
 */
export const getToolConfigurationFromFormSchema = (
  formSchema: DeploymentConfigurationSchema | undefined,
): Record<string, boolean> | undefined => {
  const properties = formSchema?.properties;
  if (properties == null) return undefined;
  const entries = Object.entries(properties).flatMap(([key, property]) => {
    const value = resolveFormSchemaBoolean(property);
    return value === undefined ? [] : [[key, value] as const];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/**
 * Returns the tool configuration a (re-)loaded conversation should show: the
 * last user message's `configuration_value`, overlaid in order by the
 * `form_schema` values of the assistant messages after it. An app that turned
 * a toggle off in its final response must not see it re-armed on reload just
 * because the user message that started the run had it on.
 */
export const getLatestToolConfiguration = (
  messages: Message[],
): Record<string, unknown> | undefined => {
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MessageRole.User) {
      lastUserIndex = i;
      break;
    }
  }
  let result = messages[lastUserIndex]?.custom_content?.configuration_value;
  for (let i = lastUserIndex + 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== MessageRole.Assistant) continue;
    const values = getToolConfigurationFromFormSchema(
      msg.custom_content?.form_schema,
    );
    if (values) result = { ...result, ...values };
  }
  return result;
};

/**
 * Returns the tool values the conversation's last message sets through its
 * `form_schema`, restricted to `toolIds`, plus a key identifying that exact
 * application. `undefined` when the last message is not an assistant message
 * or sets no known tool.
 *
 * Streamed chunks and reloads re-create an identical `form_schema`; comparing
 * keys rather than object identity applies an app's value once and leaves a
 * later user toggle alone until the app sends a different value.
 */
export const getFormSchemaToolSyncKey = (
  conversationId: string,
  messages: Message[],
  toolIds: readonly string[],
): { key: string; values: Record<string, boolean> } | undefined => {
  const messageIndex = messages.length - 1;
  const last = messages[messageIndex];
  if (last?.role !== MessageRole.Assistant) return undefined;
  const resolved = getToolConfigurationFromFormSchema(
    last.custom_content?.form_schema,
  );
  if (!resolved) return undefined;
  /* Sorted so a reordered deployment schema does not re-apply the same values. */
  const values = Object.fromEntries(
    toolIds
      .filter((id) => id in resolved)
      .sort()
      .map((id) => [id, resolved[id]]),
  );
  if (Object.keys(values).length === 0) return undefined;
  return {
    key: `${conversationId}|${messageIndex}|${JSON.stringify(values)}`,
    values,
  };
};

/**
 * Normalises a stored response-format string to the current enum. Legacy data
 * may contain `'Markdown'` or `'PlainText'` (capital-first) instead of the
 * current enum values `'markdown'` / `'plain_text'`.
 */
export const normalizeResponseFormat = (
  value: string | undefined,
): ResponseFormat => {
  const lower = (value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (lower === 'plaintext') return ResponseFormat.PlainText;
  return ResponseFormat.Markdown;
};
