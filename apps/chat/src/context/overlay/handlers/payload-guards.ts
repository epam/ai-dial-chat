import type {
  CreateConversationPayload,
  DeleteConversationPayload,
  RenameConversationPayload,
  SelectConversationPayload,
  SetOverlayOptionsPayload,
  SetTemperaturePayload,
} from '@epam/ai-dial-chat-overlay';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value) || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/** True when `payload[key]` is a string. */
export const hasStringPayload = <TKey extends string>(
  payload: unknown,
  key: TKey,
): payload is Record<TKey, string> =>
  isRecord(payload) && typeof payload[key] === 'string';

/** True when the payload carries a finite numeric `temperature`. */
export const hasTemperaturePayload = (
  payload: unknown,
): payload is SetTemperaturePayload =>
  isRecord(payload) &&
  typeof payload.temperature === 'number' &&
  Number.isFinite(payload.temperature);

const hasOptionalStringField = (
  payload: Record<string, unknown>,
  key: string,
): boolean =>
  !(key in payload) || payload[key] == null || typeof payload[key] === 'string';

const hasOptionalStringArrayField = (
  payload: Record<string, unknown>,
  key: keyof SetOverlayOptionsPayload,
): boolean =>
  !(key in payload) ||
  payload[key] == null ||
  (Array.isArray(payload[key]) &&
    (payload[key] as unknown[]).every((entry) => typeof entry === 'string'));

const SET_OVERLAY_OPTIONS_STRING_FIELDS: ReadonlyArray<
  keyof SetOverlayOptionsPayload
> = ['hostDomain', 'theme', 'modelId', 'overlayConversationId'];

/** True for an absent payload or one whose known fields have the right types. */
export const hasSetOverlayOptionsPayload = (
  payload: unknown,
): payload is Partial<SetOverlayOptionsPayload> | null | undefined => {
  if (payload == null) {
    return true;
  }
  if (!isRecord(payload)) {
    return false;
  }
  return (
    SET_OVERLAY_OPTIONS_STRING_FIELDS.every((key) =>
      hasOptionalStringField(payload, key),
    ) && hasOptionalStringArrayField(payload, 'enabledFeatures')
  );
};

/** The host's per-provider auth UI modes, or `undefined` unless every value is a string. */
export const getAuthProviderUiModes = (
  payload: Partial<SetOverlayOptionsPayload> | null | undefined,
): Record<string, string> | undefined => {
  const value = payload?.authProviderUiModes;
  if (
    !isPlainRecord(value) ||
    !Object.values(value).every((entry) => typeof entry === 'string')
  ) {
    return undefined;
  }
  return value as Record<string, string>;
};

/** The trimmed auto-sign-in provider id, or `undefined` when absent or blank. */
export const getAuthAutoSignInProvider = (
  payload: Partial<SetOverlayOptionsPayload> | null | undefined,
): string | undefined => {
  const value = payload?.authAutoSignInProvider;
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** True when the payload carries a string conversation `id`. */
export const hasSelectConversationPayload = (
  payload: unknown,
): payload is SelectConversationPayload => hasStringPayload(payload, 'id');

/** True when the payload carries a string conversation `id`. */
export const hasDeleteConversationPayload = (
  payload: unknown,
): payload is DeleteConversationPayload => hasStringPayload(payload, 'id');

/** True when the payload carries string `id` and `newName`. */
export const hasRenameConversationPayload = (
  payload: unknown,
): payload is RenameConversationPayload =>
  hasStringPayload(payload, 'id') && hasStringPayload(payload, 'newName');

/** True for an absent payload or one whose optional fields are strings. */
export const hasCreateConversationPayload = (
  payload: unknown,
): payload is Partial<CreateConversationPayload> | null | undefined => {
  if (payload == null) {
    return true;
  }
  if (!isRecord(payload)) {
    return false;
  }
  return (
    hasOptionalStringField(payload, 'deploymentId') &&
    hasOptionalStringField(payload, 'firstMessage')
  );
};
