import { FocusEvent } from 'react';

export const getMediaQuery = (query: string): MediaQueryList => {
  const mediaQueryList = window.matchMedia(query);
  return mediaQueryList;
};
export const isMediaQuery = (query: string): boolean => {
  return getMediaQuery(query).matches;
};

export const onBlur = (e: FocusEvent) => {
  e.target.classList.add('submitted', 'input-invalid');
};
