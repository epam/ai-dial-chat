/**
 * Builds the new conversation path by replacing the title segment in the filename.
 * DIAL Core stores conversations as `{deploymentId}__{title}__{uuid}`.
 */
export const buildRenamedConversationPath = (
  conversationPath: string,
  sanitisedTitle: string,
): string => {
  const segments = conversationPath.split('/');
  const filename = segments[segments.length - 1];
  const parts = filename.split('__');
  const renamedFilename =
    parts.length >= 3
      ? [parts[0], sanitisedTitle, parts[parts.length - 1]].join('__')
      : sanitisedTitle;
  return segments.length > 1
    ? [...segments.slice(0, -1), renamedFilename].join('/')
    : renamedFilename;
};
