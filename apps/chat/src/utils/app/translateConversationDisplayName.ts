import { TranslationOptions } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

type TranslateFn = (key: string, options?: TranslationOptions) => string;

export const PLAYBACK_CONVERSATION_NAME_PREFIX = '[Playback] ';
export const REPLAY_CONVERSATION_NAME_PREFIX = '[Replay] ';

export function translatePlaybackLabel(
  _locale: string | undefined,
  t: TranslateFn,
): string {
  return t(ChatI18nKeys.Playback);
}

export function translateReplayAsIsLabel(
  _locale: string | undefined,
  t: TranslateFn,
): string {
  return t(ChatI18nKeys.ReplayAsIs);
}

export function translateConversationDisplayName(
  name: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  if (name.startsWith(PLAYBACK_CONVERSATION_NAME_PREFIX)) {
    const baseName = name.slice(PLAYBACK_CONVERSATION_NAME_PREFIX.length);
    const playbackLabel = translatePlaybackLabel(locale, t);

    return `[${playbackLabel}] ${baseName}`;
  }

  if (name.startsWith(REPLAY_CONVERSATION_NAME_PREFIX)) {
    const baseName = name.slice(REPLAY_CONVERSATION_NAME_PREFIX.length);
    const replayLabel = translateReplayAsIsLabel(locale, t);

    return `[${replayLabel}] ${baseName}`;
  }

  return name;
}

export function conversationDisplayNameToStorage(
  displayName: string,
  storedName: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  if (storedName.startsWith(PLAYBACK_CONVERSATION_NAME_PREFIX)) {
    const translatedPrefix = `[${translatePlaybackLabel(locale, t)}] `;

    if (displayName.startsWith(translatedPrefix)) {
      return `${PLAYBACK_CONVERSATION_NAME_PREFIX}${displayName.slice(translatedPrefix.length)}`;
    }

    if (displayName.startsWith(PLAYBACK_CONVERSATION_NAME_PREFIX)) {
      return displayName;
    }

    return `${PLAYBACK_CONVERSATION_NAME_PREFIX}${displayName}`;
  }

  if (storedName.startsWith(REPLAY_CONVERSATION_NAME_PREFIX)) {
    const translatedPrefix = `[${translateReplayAsIsLabel(locale, t)}] `;

    if (displayName.startsWith(translatedPrefix)) {
      return `${REPLAY_CONVERSATION_NAME_PREFIX}${displayName.slice(translatedPrefix.length)}`;
    }

    if (displayName.startsWith(REPLAY_CONVERSATION_NAME_PREFIX)) {
      return displayName;
    }

    return `${REPLAY_CONVERSATION_NAME_PREFIX}${displayName}`;
  }

  return displayName;
}
