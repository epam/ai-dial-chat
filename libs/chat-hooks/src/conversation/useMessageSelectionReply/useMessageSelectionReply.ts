import type { Attachment } from '@epam/ai-dial-chat-shared';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/** A stable snapshot of one eligible native text selection. */
export interface MessageSelectionReplySnapshot {
  /** Scope that owned the selection when it was captured. */
  conversationId: string;
  /** Message text root containing the captured range. */
  body: HTMLDivElement;
  /** Captured native range. */
  range: Range;
  /** Native selected text preserved for the generated file. */
  text: string;
  /** Visible fragment of the selected range. */
  rect: DOMRect;
}

/** Parameters accepted by {@link useMessageSelectionReply}. */
export interface UseMessageSelectionReplyParams {
  /** Identifier used to discard selection and queued files after a scope change. */
  conversationId: string;
  /** Whether the host currently permits a Reply attachment. */
  enabled: boolean;
  /** Files from the host's ordinary page-drop queue. */
  droppedFiles: File[];
  /** Acknowledges the captured page-drop batch after the composer accepts it. */
  onDroppedFilesConsumed: () => void;
}

const EXCLUDED =
  'button,input,textarea,select,iframe,[role="button"],[contenteditable="true"],[hidden],[inert],[aria-hidden="true"]';
const EMPTY_FILES: File[] = [];

const sameRange = (a: Range | null, b: Range) =>
  a?.startContainer === b.startContainer &&
  a.startOffset === b.startOffset &&
  a.endContainer === b.endContainer &&
  a.endOffset === b.endOffset;

const visibleRect = (range: Range, body: HTMLElement): DOMRect | undefined => {
  const viewport = window.visualViewport;
  let left = viewport?.offsetLeft ?? 0;
  let top = viewport?.offsetTop ?? 0;
  let right = left + (viewport?.width ?? document.documentElement.clientWidth);
  let bottom =
    top + (viewport?.height ?? document.documentElement.clientHeight);
  for (let node: HTMLElement | null = body; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const rect = node.getBoundingClientRect();
    if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) {
      left = Math.max(left, rect.left);
      right = Math.min(right, rect.right);
    }
    if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) {
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
  }
  return Array.from(range.getClientRects()).find(
    (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left < right &&
      rect.right > left &&
      rect.top < bottom &&
      rect.bottom > top,
  );
};

/**
 * Captures eligible message text and creates Reply files for an existing composer
 * attachment flow without acquiring host deployment, upload or localization knowledge.
 */
export const useMessageSelectionReply = ({
  conversationId,
  enabled,
  droppedFiles,
  onDroppedFilesConsumed,
}: UseMessageSelectionReplyParams) => {
  const roots = useRef(new Set<HTMLDivElement>());
  const actionRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<MessageSelectionReplySnapshot | null>(null);
  const suppressedRange = useRef<Range | null>(null);
  const [snapshot, setSnapshot] =
    useState<MessageSelectionReplySnapshot | null>(null);
  const [queue, setQueue] = useState<{ conversationId: string; files: File[] }>(
    { conversationId, files: [] },
  );
  const [focusRequestId, setFocusRequestId] = useState<number>();
  const [addedRevision, setAddedRevision] = useState(0);
  const awaitingInsertion = useRef(new WeakSet<File>());
  const current = useRef({ conversationId, enabled });
  useLayoutEffect(() => {
    current.current = { conversationId, enabled };
  }, [conversationId, enabled]);

  const dismiss = useCallback(() => {
    suppressedRange.current = snapshotRef.current?.range.cloneRange() ?? null;
    snapshotRef.current = null;
    setSnapshot(null);
  }, []);

  const contentRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      roots.current.add(node);
      return () => {
        roots.current.delete(node);
        if (snapshotRef.current?.body === node) dismiss();
      };
    },
    [dismiss],
  );

  useEffect(() => {
    dismiss();
    suppressedRange.current = null;
    awaitingInsertion.current = new WeakSet<File>();
    setQueue({ conversationId, files: [] });
    setAddedRevision(0);
    setFocusRequestId(undefined);
  }, [conversationId, dismiss]);

  useEffect(() => {
    if (!enabled) {
      dismiss();
      setQueue({ conversationId, files: [] });
      return;
    }
    let frame = 0;
    let preservingAction = false;
    let pointerSelecting = false;
    let keyboardSelecting = false;
    const update = () => {
      frame = 0;
      if (
        preservingAction ||
        pointerSelecting ||
        keyboardSelecting ||
        actionRef.current?.contains(document.activeElement)
      )
        return;
      const selection = window.getSelection();
      if (
        !selection ||
        selection.rangeCount !== 1 ||
        selection.isCollapsed ||
        !selection.toString().trim()
      ) {
        dismiss();
        return;
      }
      const range = selection.getRangeAt(0);
      if (sameRange(suppressedRange.current, range)) return;
      const body = [...roots.current].find(
        (root) =>
          root.contains(range.startContainer) &&
          root.contains(range.endContainer),
      );
      if (!body || !body.isConnected) {
        dismiss();
        return;
      }
      /* Inline controls (citations, annotations, code actions) may sit inside
       * a prose selection. Require selected message text outside controls,
       * rather than rejecting the entire range for intersecting one. */
      const selectedContent = range.cloneContents();
      selectedContent
        .querySelectorAll(EXCLUDED)
        .forEach((node) => node.remove());
      const ancestor = range.commonAncestorContainer;
      const ancestorElement =
        ancestor instanceof Element ? ancestor : ancestor.parentElement;
      if (
        ancestorElement?.closest(EXCLUDED) ||
        !selectedContent.textContent?.trim()
      ) {
        dismiss();
        return;
      }
      const rect = visibleRect(range, body);
      if (!rect) {
        dismiss();
        return;
      }
      const next = {
        conversationId,
        body,
        range: range.cloneRange(),
        text: selection.toString(),
        rect,
      };
      snapshotRef.current = next;
      setSnapshot(next);
    };
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const handleGeometry = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        const active = snapshotRef.current;
        if (!active) return;
        const rect = visibleRect(active.range, active.body);
        if (!rect) dismiss();
        else {
          const next = { ...active, rect };
          snapshotRef.current = next;
          setSnapshot(next);
        }
      });
    };
    const handlePointerDown = (event: PointerEvent) => {
      preservingAction =
        actionRef.current?.contains(event.target as Node) ?? false;
      pointerSelecting = !preservingAction;
      if (!preservingAction) {
        dismiss();
        if (
          [...roots.current].some((root) => root.contains(event.target as Node))
        ) {
          suppressedRange.current = null;
        }
      }
    };
    const handlePointerUp = () => {
      pointerSelecting = false;
      if (!preservingAction) schedule();
      preservingAction = false;
    };
    const cancelSelection = () => {
      pointerSelecting = false;
      keyboardSelecting = false;
      preservingAction = false;
      dismiss();
      const selection = window.getSelection();
      suppressedRange.current = selection?.rangeCount
        ? selection.getRangeAt(0).cloneRange()
        : null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !actionRef.current?.contains(document.activeElement) &&
        ((event.shiftKey &&
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
            'PageUp',
            'PageDown',
          ].includes(event.key)) ||
          ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a'))
      ) {
        keyboardSelecting = true;
        dismiss();
        suppressedRange.current = null;
        return;
      }
      if (!snapshotRef.current) return;
      if (event.key === 'Escape') {
        dismiss();
        return;
      }
      if (
        event.key === 'Tab' &&
        !event.shiftKey &&
        !actionRef.current?.contains(document.activeElement)
      ) {
        const button = actionRef.current?.querySelector('button');
        if (button) {
          event.preventDefault();
          button.focus();
        }
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (keyboardSelecting && !event.shiftKey) keyboardSelecting = false;
      if (event.key !== 'Escape' && event.key !== 'Tab') schedule();
    };
    const observer = new MutationObserver((records) => {
      const active = snapshotRef.current;
      if (
        active &&
        (!active.body.isConnected ||
          records.some((record) => active.body.contains(record.target)))
      )
        dismiss();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'inert'],
    });
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', cancelSelection, true);
    window.addEventListener('blur', cancelSelection);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('scroll', handleGeometry, true);
    window.addEventListener('resize', handleGeometry);
    window.visualViewport?.addEventListener('resize', handleGeometry);
    window.visualViewport?.addEventListener('scroll', handleGeometry);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('selectionchange', schedule);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('pointercancel', cancelSelection, true);
      window.removeEventListener('blur', cancelSelection);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('scroll', handleGeometry, true);
      window.removeEventListener('resize', handleGeometry);
      window.visualViewport?.removeEventListener('resize', handleGeometry);
      window.visualViewport?.removeEventListener('scroll', handleGeometry);
    };
  }, [conversationId, dismiss, enabled]);

  const onReply = useCallback(() => {
    const active = snapshotRef.current;
    if (
      !current.current.enabled ||
      !active ||
      active.conversationId !== current.current.conversationId ||
      !active.body.isConnected ||
      !visibleRect(active.range, active.body)
    )
      return;
    const file = new File([active.text], `reply-${crypto.randomUUID()}.txt`, {
      type: 'text/plain',
    });
    awaitingInsertion.current.add(file);
    setAddedRevision(0);
    setQueue((previous) => ({
      conversationId: active.conversationId,
      files: [
        ...(previous.conversationId === active.conversationId
          ? previous.files
          : []),
        file,
      ],
    }));
    setFocusRequestId((value) => (value ?? 0) + 1);
    dismiss();
    window.getSelection()?.removeAllRanges();
  }, [dismiss]);

  const replyFiles =
    enabled && queue.conversationId === conversationId
      ? queue.files
      : EMPTY_FILES;
  const pendingFiles = useMemo(
    () => [...droppedFiles, ...replyFiles],
    [droppedFiles, replyFiles],
  );
  const onFilesConsumed = useCallback(() => {
    if (droppedFiles.length) onDroppedFilesConsumed();
    setQueue((previous) => ({
      ...previous,
      files: previous.files.filter((file) => !replyFiles.includes(file)),
    }));
  }, [droppedFiles, onDroppedFilesConsumed, replyFiles]);
  const onAttachmentsChange = useCallback((attachments: Attachment[]) => {
    const accepted = attachments.filter(
      (attachment) =>
        attachment.file && awaitingInsertion.current.has(attachment.file),
    );
    if (accepted.length) {
      accepted.forEach((attachment) =>
        awaitingInsertion.current.delete(attachment.file!),
      );
      setAddedRevision((value) => value + 1);
    }
  }, []);

  return {
    contentRef,
    actionRef,
    selection:
      enabled && snapshot?.conversationId === conversationId ? snapshot : null,
    onReply,
    dismiss,
    pendingFiles,
    onFilesConsumed,
    focusRequestId,
    onAttachmentsChange,
    addedRevision,
  };
};
