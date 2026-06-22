const summarizeNames = (
  items: Array<{ name?: string; nodeType?: string; path?: string }>,
): string =>
  items
    .map(
      (item) =>
        `${item.name ?? '?'}(${item.nodeType ?? '?'})${item.path ? `@${item.path}` : ''}`,
    )
    .join(', ') || '(none)';

export const summarizeDialRawItems = summarizeNames;

export const summarizeListFilesItems = summarizeNames;
