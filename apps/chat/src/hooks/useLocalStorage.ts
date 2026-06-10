import { useCallback, useState } from 'react';

/**
 * Persists a value to localStorage so it survives page reloads.
 * All localStorage access is wrapped in try/catch: private-browsing modes and
 * storage-quota errors must not break the UI — the hook falls back to the
 * in-memory state value and silently skips writes when storage is unavailable.
 */
const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item != null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T) => {
      setStoredValue(value);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage unavailable — in-memory state is still updated above
      }
    },
    [key],
  );

  return [storedValue, setValue];
};

export default useLocalStorage;
