import type { Stage } from '@epam/ai-dial-chat-shared';
import { prepareCitationContent } from '@epam/ai-dial-quotations';

/**
 * Returns `stages` with citation markup in each stage's `content` prepared
 * for rendering (hidden while streaming, unsupported shapes escaped), keeping
 * every stage without `<cit` markup — and the array itself when none has
 * any — by reference so memoized stage rows are not re-rendered.
 */
export const prepareStageCitations = (
  stages: Stage[],
  isStreaming: boolean,
): Stage[] => {
  if (!stages.some((stage) => stage.content?.includes('<cit'))) return stages;
  return stages.map((stage) =>
    stage.content?.includes('<cit')
      ? {
          ...stage,
          content: prepareCitationContent(stage.content, isStreaming),
        }
      : stage,
  );
};
