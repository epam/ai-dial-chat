/* Session storage can be unavailable (private mode, blocked site data); a
 * failed read means "nothing stored" and a failed write is skipped. */

export const getFromSessionStorage = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const setToSessionStorage = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* Not persisted; the value still applies until the page reloads. */
  }
};

export const removeFromSessionStorage = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Nothing stored to remove. */
  }
};
