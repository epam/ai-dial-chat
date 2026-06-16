const CONVERSATION_NAME_SEPARATOR = '__';
const VERSION_METADATA_SEPARATOR_REGEX = /[-+]/;
const VERSION_NUMBER_PART_REGEX = /^\d+$/;

const isDeploymentVersionSuffix = (value?: string): boolean => {
  if (!value) return false;

  const numericVersion = value.split(VERSION_METADATA_SEPARATOR_REGEX)[0];
  return numericVersion
    .split('.')
    .every((part) => VERSION_NUMBER_PART_REGEX.test(part));
};

const getDeploymentIdPartFromFilenamePart = (filenamePart: string): string => {
  const [deploymentName, versionSuffix] = filenamePart.split(
    CONVERSATION_NAME_SEPARATOR,
  );

  return isDeploymentVersionSuffix(versionSuffix)
    ? [deploymentName, versionSuffix].join(CONVERSATION_NAME_SEPARATOR)
    : deploymentName;
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
 * The `__` separator is present in the first filename segment. Versioned
 * application deployments use `{name}__{version}__{title}`, so the version
 * suffix still belongs to the deployment ID.
 *
 * In regular model conversations, the separator is always present in exactly
 * one segment — the first one that contains it. Segments before that segment
 * are deployment ID path prefixes; segments from that point onward are the
 * title (possibly overflowing into further `/`-separated segments).
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

  // Find the FIRST segment that contains '__'. Everything before it
  // is the deployment ID prefix; the part before '__' in that segment is the
  // final piece of the deployment ID.
  const separatorIndex = deploymentSegments.findIndex((seg) =>
    seg.includes(CONVERSATION_NAME_SEPARATOR),
  );

  if (separatorIndex === -1) return undefined;

  const separatorSegment = deploymentSegments[separatorIndex];
  const lastDeploymentPart =
    getDeploymentIdPartFromFilenamePart(separatorSegment);

  const prefixParts = deploymentSegments
    .slice(0, separatorIndex)
    .filter(Boolean);

  const allParts = [...prefixParts, lastDeploymentPart].filter(Boolean);
  return allParts.length > 0 ? allParts.join('/') : undefined;
};
