/**
 * Extracts the deployment/model ID from a DIAL Core conversation ID.
 * Conversation IDs follow the format `{bucket}/{deploymentId}__{title}__{uuid}`.
 * Returns `undefined` when the format is unrecognised.
 */
export const getModelIdFromConversationId = (
  id: string,
): string | undefined => {
  const lastSegment = id.split('/').pop() ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(lastSegment);
  } catch {
    decoded = lastSegment;
  }
  const idx = decoded.indexOf('__');
  return idx === -1 ? undefined : decoded.slice(0, idx);
};
