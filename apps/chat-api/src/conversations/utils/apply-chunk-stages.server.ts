import {
  StageAttachmentDto as StageAttachment,
  StageDto as Stage,
} from '../dto/stage.dto';

const mergeStageAttachments = (
  existing: StageAttachment[],
  incoming: StageAttachment[],
): StageAttachment[] => {
  const result = [...existing];
  for (const att of incoming) {
    const idx =
      att.index != null ? result.findIndex((a) => a.index === att.index) : -1;
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        ...att,
        title: (result[idx].title ?? '') + (att.title ?? ''),
        data:
          att.data != null
            ? (result[idx].data ?? '') + att.data
            : result[idx].data,
      };
    } else {
      result.push(att);
    }
  }
  return result;
};

const mergeOptionalText = (
  existing: string | undefined,
  incoming: string | undefined,
): string | undefined =>
  existing !== undefined || incoming !== undefined
    ? (existing ?? '') + (incoming ?? '')
    : undefined;

/** Merges incoming stage deltas into the existing stage list by `index`, concatenating `name`/`content`/attachments. */
export const mergeStages = (existing: Stage[], incoming: Stage[]): Stage[] => {
  const result = [...existing];
  for (const stage of incoming) {
    const idx = result.findIndex((s) => s.index === stage.index);
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        ...stage,
        name: (result[idx].name ?? '') + (stage.name ?? ''),
        content: mergeOptionalText(result[idx].content, stage.content),
        attachments: stage.attachments?.length
          ? mergeStageAttachments(
              result[idx].attachments ?? [],
              stage.attachments,
            )
          : result[idx].attachments,
      };
    } else {
      /*
       * A brand-new stage's first chunk can carry `name: null` (DIAL Core's
       * "stage opened, name pending" signal, before the name text streams
       * in) — normalize it the same way the merge branch above already
       * coalesces `null` to `''`, so a persisted stage never carries a
       * `null` name if the frontend renders it directly after reload.
       */
      result.push({ ...stage, name: stage.name ?? '' });
    }
  }
  return result;
};
