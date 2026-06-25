export const getFromLocalStorage = (key?: string) => {
  if (!key || typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem(key);
};

export const setToLocalStorage = (key: string, value: string) => {
  localStorage.setItem(key, value);
};

const LAST_CONVERSATION_SETTINGS_KEY = 'lastConversationSettings';

interface LastConversationSettings {
  temperature: number;
  responseFormat?: string;
}

export const getLastConversationSettings =
  (): LastConversationSettings | null => {
    try {
      const raw = localStorage.getItem(LAST_CONVERSATION_SETTINGS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as LastConversationSettings;
    } catch {
      return null;
    }
  };

export const setLastConversationSettings = (
  settings: LastConversationSettings,
): void => {
  localStorage.setItem(
    LAST_CONVERSATION_SETTINGS_KEY,
    JSON.stringify(settings),
  );
};
