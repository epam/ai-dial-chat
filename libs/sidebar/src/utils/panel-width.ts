/** Bounds all overlay sizing paths without replacing the user's preferred width. */
export const resolvePanelWidth = (
  preferredWidth: number,
  minWidth: number,
  maxWidth: number,
  availableWidth: number,
) => {
  const maximum = Math.max(0, Math.min(maxWidth, availableWidth - 32));
  const minimum = Math.max(0, Math.min(minWidth, maximum));
  return {
    width: Math.min(maximum, Math.max(minimum, preferredWidth)),
    minWidth: minimum,
    maxWidth: maximum,
  };
};
