import {
  getConversationTitleFromName,
  isApplicationDeploymentPath,
} from './conversation.utils';

export const CONVERSATION_RESOURCE_ID_PATTERN =
  /^conversations\/[A-Za-z0-9_-]+\/[^\p{Cc}\\]+$/u;
export const CONVERSATION_RESOURCE_ID_MAX_LENGTH = 4096;

/** Parses a full resource URL without decoding literal escapes a second time. */
export const parseConversationResourceId = (value: string) => {
  if (
    typeof value !== 'string' ||
    value.length > CONVERSATION_RESOURCE_ID_MAX_LENGTH ||
    !CONVERSATION_RESOURCE_ID_PATTERN.test(value)
  ) {
    return undefined;
  }
  const [, bucket, ...encodedSegments] = value.split('/');
  try {
    const segments = encodedSegments.map((segment) =>
      decodeURIComponent(segment),
    );
    for (const segment of segments) {
      let checked = segment;
      /* Reject traversal and control characters even behind nested escapes. */
      for (;;) {
        if (
          checked
            .split('/')
            .some((part) => !part || part === '.' || part === '..') ||
          /[\p{Cc}\\]/u.test(checked)
        ) {
          return undefined;
        }
        let decoded: string;
        try {
          decoded = decodeURIComponent(checked);
        } catch {
          break;
        }
        if (decoded === checked) break;
        checked = decoded;
      }
    }
    const path = segments.map(encodeURIComponent).join('/');
    return {
      id: `conversations/${bucket}/${path}`,
      bucket,
      path,
      pathTitle: getConversationTitleFromName(
        segments.at(-1) ?? '',
        isApplicationDeploymentPath(segments.slice(0, -1).join('/')),
      ),
    };
  } catch {
    return undefined;
  }
};
