import type { CustomVisualizer } from '@epam/ai-dial-chat-shared';

/**
 * Returns the first `CustomVisualizer` registry entry whose `contentType` list
 * (comma-separated, case-insensitive) includes `mimeType`, or `undefined` if
 * none match. First-match-wins when multiple entries cover the same MIME type.
 */
export const findVisualizerForMime = (
  mimeType: string,
  visualizers: CustomVisualizer[],
): CustomVisualizer | undefined => {
  const needle = mimeType.toLowerCase();
  return visualizers.find((entry) =>
    entry.contentType
      .split(',')
      .some(
        (part) => part.trim().toLowerCase() === needle && part.trim() !== '',
      ),
  );
};
