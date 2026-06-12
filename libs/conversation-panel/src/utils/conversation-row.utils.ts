export const SKELETON_ROW_COUNT = 15;

export const getSkeletonWidth = (i: number) => `${60 + ((i * 23) % 35)}%`;

/** Returns the inline-end padding Tailwind class for the row's ghost button based on action state. */
export const getButtonPaddingEnd = (
  hasActions: boolean,
  isMenuOpen: boolean,
): string => {
  if (!hasActions) return 'pe-3';
  if (isMenuOpen) return 'pe-9';
  return 'pe-2 group-hover:pe-9';
};
