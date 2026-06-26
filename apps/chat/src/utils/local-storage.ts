export const getFromLocalStorage = (key?: string) => {
  if (!key || typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem(key);
};

export const setToLocalStorage = (key: string, value: string) => {
  localStorage.setItem(key, value);
};
