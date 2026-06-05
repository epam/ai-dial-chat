/** Returns the right-padding Tailwind class for the row's ghost button based on action state. */
export const getButtonPaddingRight = (
  hasActions: boolean,
  isMenuOpen: boolean,
): string => {
  if (!hasActions) return 'pr-3';
  if (isMenuOpen) return 'pr-9';
  return 'pr-2 group-hover:pr-9';
};
