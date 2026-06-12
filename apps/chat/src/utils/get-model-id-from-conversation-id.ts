const safeDecodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * Extracts the deployment/model ID from a DIAL Core conversation ID.
 *
 * The backend builds conversation paths as `{deploymentId}__{title}` then runs
 * `encodeDialResourcePath` which splits on `/` and encodes each segment. This
 * means both the deployment ID and the title may introduce extra `/`-separated
 * URL segments:
 *
 *   - Deployment `anthropic/claude-3`, title `My chat`
 *     → `conversations/bucket/anthropic/claude-3__My%20chat`
 *
 *   - Deployment `uuid`, title `calc 6/2/2026` (title contains slashes)
 *     → `conversations/bucket/uuid__calc%206/2/2026`
 *
 * The `__` separator is always present in exactly one segment — the first one
 * that contains it. Segments before that segment are deployment ID path
 * prefixes; segments from that point onward are the title (possibly
 * overflowing into further `/`-separated segments).
 *
 * Returns `undefined` when the format is unrecognised.
 */
export const getModelIdFromConversationId = (
  id: string,
): string | undefined => {
  const segments = id.split('/');

  // Minimum structure: "conversations", "{bucket}", "{deploymentPart}__{title}"
  if (segments.length < 3) return undefined;

  // segments[0] = "conversations", segments[1] = bucket
  const deploymentSegments = segments.slice(2);

  // Find the FIRST segment that contains '__'. Everything before it (decoded)
  // is the deployment ID prefix; the part before '__' in that segment is the
  // final piece of the deployment ID.
  const separatorIndex = deploymentSegments.findIndex((seg) =>
    safeDecodeSegment(seg).includes('__'),
  );

  if (separatorIndex === -1) return undefined;

  const separatorSegment = safeDecodeSegment(
    deploymentSegments[separatorIndex],
  );
  const idx = separatorSegment.indexOf('__');
  const lastDeploymentPart = separatorSegment.slice(0, idx);

  const prefixParts = deploymentSegments
    .slice(0, separatorIndex)
    .map(safeDecodeSegment)
    .filter(Boolean);

  const allParts = [...prefixParts, lastDeploymentPart].filter(Boolean);
  return allParts.length > 0 ? allParts.join('/') : undefined;
};
