import {
  type OverlayChatMessage,
  type OverlayMessageStage,
  OverlayStageStatus,
} from '@epam/ai-dial-chat-overlay';
import {
  type Message,
  type Stage,
  StageStatus,
} from '@epam/ai-dial-chat-shared';

/*
 * `StageStatus` and `OverlayStageStatus` share their wire values, but they are
 * separate enums on purpose: the protocol must not re-export the chat's own
 * model. Map explicitly so an unrecognised value degrades to "still running"
 * rather than crossing the boundary untranslated.
 */
const toOverlayStageStatus = (
  status: Stage['status'],
): OverlayStageStatus | null => {
  switch (status) {
    case StageStatus.Completed:
      return OverlayStageStatus.Completed;
    case StageStatus.Failed:
      return OverlayStageStatus.Failed;
    default:
      return null;
  }
};

/*
 * Attachments are deliberately dropped: they carry host-resolvable URLs the
 * protocol has no counterpart for.
 */
const toOverlayStages = (
  stages: Stage[] | undefined,
): OverlayMessageStage[] | undefined =>
  stages?.length
    ? stages.map((stage) => ({
        index: stage.index,
        name: stage.name,
        status: toOverlayStageStatus(stage.status),
        ...(stage.content === undefined ? {} : { content: stage.content }),
        ...(stage.tag === undefined ? {} : { tag: stage.tag }),
      }))
    : undefined;

/** Maps chat messages to the DIAL Chat Overlay protocol's message shape. */
export const toOverlayMessages = (messages: Message[]): OverlayChatMessage[] =>
  messages.map((message, index) => {
    const stages = toOverlayStages(message.custom_content?.stages);
    return {
      id: index.toString(),
      role: message.role,
      content: message.content,
      ...(stages ? { stages } : {}),
    };
  });
