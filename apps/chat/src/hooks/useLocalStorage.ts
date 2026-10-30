import { usePersistedState } from '@epam/ai-dial-chat-hooks/utils';

const storage = {
  read: (key: string) => localStorage.getItem(key),
  write: (key: string, value: string) => localStorage.setItem(key, value),
};
const codec = { decode: JSON.parse, encode: JSON.stringify };
/** Persists JSON state in localStorage, retaining in-memory state when storage fails. */
const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] =>
  usePersistedState({ key, initialValue, storage, codec });

export default useLocalStorage;
