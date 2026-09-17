import type {
  ApplicationVisualizer,
  ApplicationVisualizerRegistry,
  CustomVisualizer,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';

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

/**
 * Returns the `ApplicationVisualizer` registered for `applicationId`, or
 * `undefined` when the id is absent, empty, or not a key of the registry.
 * Keys are compared by exact string equality — deployment ids are opaque and
 * are never trimmed or case-folded.
 */
export const findVisualizerForApplication = (
  applicationId: string | undefined,
  visualizers: ApplicationVisualizerRegistry,
): ApplicationVisualizer | undefined => {
  if (applicationId == null || applicationId === '') {
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(visualizers, applicationId)
    ? visualizers[applicationId]
    : undefined;
};

/**
 * Returns the canvas-selection key identifying a message's grouped visualizer,
 * so the host can tell whether that visualizer is the one currently open in
 * the canvas and replace its inline frame with a placeholder.
 */
export const groupedVisualizerCanvasKey = (messageIndex: number): string =>
  `${messageIndex}:grouped-visualizer`;

/** Attachments split by whether an `ApplicationVisualizer` entry claims them. */
export interface ApplicationVisualizerPartition {
  /** Attachments the entry claims, to be sent as one grouped payload. In the input's order. */
  claimed: DisplayAttachment[];
  /** Attachments the entry does not claim, to be rendered as ordinary tiles. In the input's order. */
  unclaimed: DisplayAttachment[];
}

/**
 * Splits `attachments` into the ones `visualizer` claims and the ones it does
 * not. An entry with a `contentType` claims the attachments whose own
 * `contentType` appears in its comma-separated list (compared
 * case-insensitively); an entry without one claims every attachment that
 * carries a URL. Both sides keep the input order.
 */
export const partitionAttachmentsForApplicationVisualizer = (
  attachments: DisplayAttachment[],
  visualizer: ApplicationVisualizer,
): ApplicationVisualizerPartition => {
  const declaredMimes = (visualizer.contentType ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '');

  const claimed: DisplayAttachment[] = [];
  const unclaimed: DisplayAttachment[] = [];

  attachments.forEach((attachment) => {
    const hasUrl = attachment.url != null && attachment.url !== '';
    /* No declared MIME list means "every attachment with a URL"; a declared
     * list still requires a URL, because the grouped payload addresses each
     * attachment by absolute URL and has no channel for inline data. */
    const isClaimed =
      hasUrl &&
      (declaredMimes.length === 0 ||
        declaredMimes.includes(attachment.contentType.toLowerCase()));

    if (isClaimed) {
      claimed.push(attachment);
      return;
    }
    unclaimed.push(attachment);
  });

  return { claimed, unclaimed };
};
