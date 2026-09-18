import type { MessageAttachment, Stage } from '@epam/ai-dial-chat-shared';
import { StageStatus } from '@epam/ai-dial-chat-shared';

/**
 * One stage attachment as it arrives from the REST API or the SSE stream,
 * before normalization: every field is optional and may be `null`.
 */
export interface RawStageAttachment {
  /** Zero-based position in the attachment list. */
  index?: number | null;
  /** MIME type of the attachment content. */
  type?: string | null;
  /** Display name shown in the UI. */
  title?: string | null;
  /** Inline base-64 encoded content. */
  data?: string | null;
  /** Remote URL pointing to the attachment content. */
  url?: string | null;
  /** MIME type of the referenced resource. */
  reference_type?: string | null;
  /** URL of an alternate reference resource. */
  reference_url?: string | null;
}

/**
 * One stage as it arrives from the REST API or the SSE stream, before
 * normalization. Structurally satisfied by the generated `StageDto` and by a
 * raw stream delta, both of which omit `index`/`name`/`status` on the chunk
 * that opens a stage.
 */
export interface RawStage {
  /** Ordering key. Defaults to `0` when absent. */
  index?: number | null;
  /** Stage title. `null` on the chunk that opens the stage. */
  name?: string | null;
  /** Terminal state as a raw wire string; anything other than `'completed'`/`'failed'` means still running. */
  status?: string | null;
  /** Additional stage text. */
  content?: string | null;
  /** Short source/category label shown beside the stage name. */
  tag?: string | null;
  /** Files produced or referenced by this stage. */
  attachments?: RawStageAttachment[] | null;
}

/**
 * Message-like payload carrying stages under either the wire's snake_case
 * `custom_content` or a host's camelCased `customContent`.
 */
export interface RawStageSource {
  /** Custom content as the DIAL wire format spells it. */
  custom_content?: { stages?: RawStage[] | null } | null;
  /** Custom content as a camelCasing host spells it. */
  customContent?: { stages?: RawStage[] | null } | null;
}

const toStageStatus = (status: RawStage['status']): StageStatus | null => {
  if (status === StageStatus.Completed) return StageStatus.Completed;
  if (status === StageStatus.Failed) return StageStatus.Failed;
  return null;
};

const toStageAttachment = (
  attachment: RawStageAttachment,
): MessageAttachment => ({
  title: attachment.title ?? '',
  ...(attachment.index != null && { index: attachment.index }),
  ...(attachment.type != null && { type: attachment.type }),
  ...(attachment.data != null && { data: attachment.data }),
  ...(attachment.url != null && { url: attachment.url }),
  ...(attachment.reference_type != null && {
    reference_type: attachment.reference_type,
  }),
  ...(attachment.reference_url != null && {
    reference_url: attachment.reference_url,
  }),
});

/**
 * Returns a renderable `Stage` for one raw payload: `index` defaults to `0`,
 * `name` to `''`, an unrecognized `status` to `null` (still running), and
 * `content`/`tag`/`attachments` are passed through when present.
 */
export const toStage = (stage: RawStage): Stage => ({
  index: stage.index ?? 0,
  name: stage.name ?? '',
  status: toStageStatus(stage.status),
  ...(stage.content != null && { content: stage.content }),
  ...(stage.tag != null && { tag: stage.tag }),
  ...(stage.attachments?.length && {
    attachments: stage.attachments.map(toStageAttachment),
  }),
});

/**
 * Returns the normalized stages of a raw stage array or a message-like
 * payload (reading `custom_content.stages`, falling back to
 * `customContent.stages`), or `undefined` when there are none.
 */
export const mapStages = (
  source: RawStage[] | RawStageSource | null | undefined,
): Stage[] | undefined => {
  const stages = Array.isArray(source)
    ? source
    : (source?.custom_content?.stages ?? source?.customContent?.stages);

  if (!stages?.length) return undefined;

  return stages.map(toStage);
};
