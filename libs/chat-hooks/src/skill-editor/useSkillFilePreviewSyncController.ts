import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import type { SkillFileTreeNode } from '@epam/ai-dial-skill-editor';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  skillFileToAttachment,
  type SkillFileContent,
} from '../skill/skill-file-preview';

/** Presentation state of a supporting-file preview. */
export enum SkillFilePreviewState {
  Idle = 'idle',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}
/** Resolved selection and host canvas operations. */
export interface SkillFilePreviewSyncOptions {
  /** Selected file; absent for manifest or folder views. */
  node?: SkillFileTreeNode;
  /** Already loaded file bytes. */
  content?: SkillFileContent;
  /** Reads already-loaded bytes during reconciliation; never fetches. */
  getContent?: () => SkillFileContent | undefined;
  /** Opaque host resource key. */
  canvasAttachmentId?: string;
  /** Content replacement revision. */
  contentRevision: number;
  /** Currently displayed canvas identity. */
  currentCanvasId?: string;
  /** Whether canvas content is visible. */
  isCanvasOpen: boolean;
  /** Whether canvas content is loading. */
  isCanvasLoading: boolean;
  /** Provider-scoped request authority. */
  beginRequest: () => () => boolean;
  /** Opens content, consulting the predicate before asynchronous writes. */
  openAttachmentCanvas: (
    attachment: DisplayAttachment,
    id: string,
    shouldCommit: () => boolean,
  ) => Promise<boolean>;
  /** Closes the currently owned canvas. */
  closeCanvas: () => void;
}
/** Synchronizes resolved file selection while preserving shared canvas ownership. */
export const useSkillFilePreviewSyncController = ({
  node,
  content,
  getContent,
  canvasAttachmentId,
  contentRevision,
  currentCanvasId,
  isCanvasOpen,
  isCanvasLoading,
  beginRequest,
  openAttachmentCanvas,
  closeCanvas,
}: SkillFilePreviewSyncOptions) => {
  const [failed, setFailed] = useState<{ id: string; revision: number }>();
  const [retryCount, setRetryCount] = useState(0);
  const request = useRef<
    | {
        id: string;
        revision: number;
        retry: number;
        valid: boolean;
        owns: () => boolean;
      }
    | undefined
  >(undefined);
  useLayoutEffect(
    () => () => {
      const current = request.current;
      if (current) {
        current.valid = false;
        if (current.owns()) closeCanvas();
        request.current = undefined;
      }
    },
    [closeCanvas],
  );
  useEffect(() => {
    const previous = request.current;
    const selectedContent = getContent ? getContent() : content;
    if (!node || !selectedContent || !canvasAttachmentId) {
      if (previous) {
        previous.valid = false;
        if (previous.owns()) closeCanvas();
        request.current = undefined;
      }
      return;
    }
    if (
      previous?.id === canvasAttachmentId &&
      previous.revision === contentRevision &&
      previous.retry === retryCount
    )
      return;
    if (previous) previous.valid = false;
    const current = {
      id: canvasAttachmentId,
      revision: contentRevision,
      retry: retryCount,
      valid: true,
      owns: beginRequest(),
    };
    request.current = current;
    setFailed(undefined);
    const canCommit = () => current.valid && current.owns();
    const open = async () => {
      let opened = false;
      try {
        opened = await openAttachmentCanvas(
          skillFileToAttachment(node, selectedContent),
          canvasAttachmentId,
          canCommit,
        );
      } catch {
        opened = false;
      }
      if (canCommit() && !opened)
        setFailed({ id: canvasAttachmentId, revision: contentRevision });
    };
    void open();
  }, [
    node,
    content,
    getContent,
    canvasAttachmentId,
    contentRevision,
    retryCount,
    beginRequest,
    openAttachmentCanvas,
    closeCanvas,
  ]);
  const retry = useCallback(() => setRetryCount((value) => value + 1), []);
  const state =
    !node || (!content && !getContent) || !canvasAttachmentId
      ? SkillFilePreviewState.Idle
      : failed?.id === canvasAttachmentId && failed.revision === contentRevision
        ? SkillFilePreviewState.Error
        : currentCanvasId === canvasAttachmentId &&
            isCanvasOpen &&
            !isCanvasLoading
          ? SkillFilePreviewState.Ready
          : SkillFilePreviewState.Loading;
  return { state, retry };
};
