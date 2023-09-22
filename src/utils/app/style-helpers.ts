export const getMediaQuery = (query: string): MediaQueryList => {
  const mediaQueryList = window.matchMedia(query);
  return mediaQueryList;
};
export const isMediaQuery = (query: string): boolean => {
  return getMediaQuery(query).matches;
};
