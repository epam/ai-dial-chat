/**
 * Returns the provided name without its trailing file extension.
 */
export const getNameWithoutExtension = (name: string): string => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
};
