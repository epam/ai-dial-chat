import type { SkillFileContent } from '@epam/ai-dial-chat-hooks/skill-editor';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillFilePreviewState } from '../../../types/skill-file-preview';
import { useSkillFilePreviewSync } from '../useSkillFilePreviewSync';

/*
 * A faithful stand-in for the shared canvas and for `useOpenAttachmentCanvas`:
 * the open writes canvas state itself — a loading state synchronously, then
 * content or a close once its resolver settles — and consults the caller's
 * `shouldCommit` guard immediately before each post-await write, exactly where
 * the library does. That placement is the point: a check made after the write
 * could only undo it, which is visible.
 */
interface CanvasState {
  isOpen: boolean;
  isLoading: boolean;
  attachmentId: string | undefined;
}

interface PendingOpen {
  canvasAttachmentId: string;
  settle: (opened: boolean) => void;
}

let canvas: CanvasState = {
  isOpen: false,
  isLoading: false,
  attachmentId: undefined,
};
let listeners: Array<() => void> = [];
let pending: PendingOpen[] = [];

function subscribe(onStoreChange: () => void) {
  listeners.push(onStoreChange);
  return () => {
    listeners = listeners.filter((listener) => listener !== onStoreChange);
  };
}

const setCanvas = (next: CanvasState) => {
  canvas = next;
  listeners.forEach((listener) => listener());
};

const closeCanvas = vi.fn(() => {
  setCanvas({ isOpen: false, isLoading: false, attachmentId: undefined });
});

const openAttachmentCanvas = vi.fn(
  (
    _attachment: unknown,
    canvasAttachmentId: string,
    shouldCommit?: () => boolean,
  ) => {
    /* `openCanvasLoading` — synchronous, before any await, so never guarded. */
    setCanvas({
      isOpen: false,
      isLoading: true,
      attachmentId: canvasAttachmentId,
    });
    return new Promise<boolean>((resolve) => {
      pending.push({
        canvasAttachmentId,
        settle: (opened: boolean) => {
          if (shouldCommit != null && !shouldCommit()) {
            resolve(false);
            return;
          }
          if (opened) {
            setCanvas({
              isOpen: true,
              isLoading: false,
              attachmentId: canvasAttachmentId,
            });
          } else {
            closeCanvas();
          }
          resolve(opened);
        },
      });
    });
  },
);

vi.mock('@epam/ai-dial-attachment-canvas', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAttachmentCanvas: () => {
      const state = useSyncExternalStore(subscribe, () => canvas);
      return { ...state, closeCanvas };
    },
    useOpenAttachmentCanvas: () => ({ openAttachmentCanvas }),
  };
});

vi.mock('../useAttachmentCanvasResolvers', () => ({
  useAttachmentCanvasResolvers: () => ({ resolvers: {}, options: {} }),
}));

const MANIFEST = 'SKILL.md';

/**
 * Settles the pending open for `path`. `which` picks between two opens for the
 * same path — the A -> B -> A ordering the id comparison alone cannot tell
 * apart. Matches whichever canvas id the hook passed.
 */
const settle = async (
  path: string,
  { opened = true, which = 'oldest' as 'oldest' | 'newest' } = {},
) => {
  const matches = pending.filter(
    (entry) =>
      entry.canvasAttachmentId === path ||
      entry.canvasAttachmentId.endsWith(`#${path}`),
  );
  if (matches.length === 0) throw new Error(`No pending open for ${path}`);
  const entry = which === 'oldest' ? matches[0] : matches[matches.length - 1];
  pending = pending.filter((candidate) => candidate !== entry);
  await act(async () => {
    entry.settle(opened);
    await Promise.resolve();
  });
};

const fileNode = (path: string): SkillFileTreeNode => ({
  path,
  name: path.split('/').pop() as string,
  kind: SkillFileNodeKind.File,
});

const contentRef = (paths: string[]) => ({
  current: new Map<string, SkillFileContent>(
    paths.map((path) => [
      path,
      { bytes: new Uint8Array([1, 2, 3]), mimeType: 'text/markdown' },
    ]),
  ),
});

const scopedId = (resourceKey: string, path: string) =>
  `${resourceKey}#${path}`;

const renderSync = (initial: {
  selectedPath: string;
  resourceKey: string;
  paths: string[];
}) => {
  const files = initial.paths.map(fileNode);
  const filesContentRef = contentRef(initial.paths);
  return renderHook(
    ({
      selectedPath,
      resourceKey,
    }: {
      selectedPath: string;
      resourceKey: string;
    }) =>
      useSkillFilePreviewSync({
        selectedPath,
        canvasAttachmentId:
          selectedPath === MANIFEST
            ? undefined
            : scopedId(resourceKey, selectedPath),
        files,
        filesContentRef,
      }),
    {
      initialProps: {
        selectedPath: initial.selectedPath,
        resourceKey: initial.resourceKey,
      },
    },
  );
};

const SKILL = 'my-bucket/team-a/docs-helper';

describe('useSkillFilePreviewSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pending = [];
    listeners = [];
    canvas = { isOpen: false, isLoading: false, attachmentId: undefined };
  });

  describe('out-of-order completion', () => {
    it('leaves B displayed, and does not reopen it, when A completes after B', async () => {
      const { rerender } = renderSync({
        selectedPath: 'a.md',
        resourceKey: SKILL,
        paths: ['a.md', 'b.md'],
      });

      rerender({ selectedPath: 'b.md', resourceKey: SKILL });
      await settle('b.md');
      await settle('a.md');

      expect(canvas).toEqual({
        isOpen: true,
        isLoading: false,
        attachmentId: scopedId(SKILL, 'b.md'),
      });
      /* One open for A and one for B. A third would mean B's content was
         clobbered and had to be fetched again — the flicker the commit-time
         guard exists to prevent. */
      expect(openAttachmentCanvas).toHaveBeenCalledTimes(2);
    });

    it('ignores the first A when the selection went A -> B -> A and the first A completes last', async () => {
      const { rerender } = renderSync({
        selectedPath: 'a.md',
        resourceKey: SKILL,
        paths: ['a.md', 'b.md'],
      });

      rerender({ selectedPath: 'b.md', resourceKey: SKILL });
      rerender({ selectedPath: 'a.md', resourceKey: SKILL });
      expect(openAttachmentCanvas).toHaveBeenCalledTimes(3);

      await settle('b.md');
      await settle('a.md', { which: 'newest' });
      const stateAfterCurrent = { ...canvas };
      /* The superseded first request for the same file, resolving last. An id
         comparison would call it current, because its id is current again. */
      await settle('a.md', { which: 'oldest' });

      expect(canvas).toEqual(stateAfterCurrent);
      expect(canvas.attachmentId).toBe(scopedId(SKILL, 'a.md'));
      expect(canvas.isOpen).toBe(true);
      expect(openAttachmentCanvas).toHaveBeenCalledTimes(3);
    });

    it('does not reopen the preview when A completes after a return to SKILL.md', async () => {
      const { rerender } = renderSync({
        selectedPath: 'a.md',
        resourceKey: SKILL,
        paths: ['a.md'],
      });

      rerender({ selectedPath: MANIFEST, resourceKey: SKILL });
      await settle('a.md');

      expect(canvas).toEqual({
        isOpen: false,
        isLoading: false,
        attachmentId: undefined,
      });
    });

    it('leaves the next owner canvas untouched when A completes after the editor is gone', async () => {
      const { unmount } = renderSync({
        selectedPath: 'a.md',
        resourceKey: SKILL,
        paths: ['a.md'],
      });

      unmount();
      /* Something else takes the shared canvas over — a conversation
         attachment, say — before the abandoned editor request settles. */
      const nextOwner: CanvasState = {
        isOpen: true,
        isLoading: false,
        attachmentId: 'conversation#report.pdf',
      };
      setCanvas({ ...nextOwner });

      await settle('a.md');

      expect(canvas).toEqual(nextOwner);
    });

    it('does not close the next owner canvas when an abandoned request finds nothing to show', async () => {
      const { unmount } = renderSync({
        selectedPath: 'a.md',
        resourceKey: SKILL,
        paths: ['a.md'],
      });

      unmount();
      const nextOwner: CanvasState = {
        isOpen: true,
        isLoading: false,
        attachmentId: 'conversation#report.pdf',
      };
      setCanvas({ ...nextOwner });

      await settle('a.md', { opened: false });

      expect(canvas).toEqual(nextOwner);
    });

    it('does not attribute a stale failure to the newer selection', async () => {
      const { result, rerender } = renderSync({
        selectedPath: 'a.md',
        resourceKey: SKILL,
        paths: ['a.md', 'b.md'],
      });

      rerender({ selectedPath: 'b.md', resourceKey: SKILL });
      await settle('b.md');
      expect(result.current.state).toBe(SkillFilePreviewState.Ready);

      await settle('a.md', { opened: false });

      expect(result.current.state).toBe(SkillFilePreviewState.Ready);
      expect(canvas.attachmentId).toBe(scopedId(SKILL, 'b.md'));
      expect(canvas.isOpen).toBe(true);
    });

    it('reports an error only for the selection that actually failed', async () => {
      const { result } = renderSync({
        selectedPath: 'a.md',
        resourceKey: SKILL,
        paths: ['a.md'],
      });

      await settle('a.md', { opened: false });

      expect(result.current.state).toBe(SkillFilePreviewState.Error);
    });
  });

  describe('resource-scoped identity', () => {
    it('reopens the preview when the same relative path is selected in a different skill', async () => {
      const otherSkill = 'my-bucket/team-a/other-helper';
      const { rerender } = renderSync({
        selectedPath: 'docs/guide.pdf',
        resourceKey: SKILL,
        paths: ['docs/guide.pdf'],
      });
      await settle('docs/guide.pdf');
      expect(openAttachmentCanvas).toHaveBeenCalledTimes(1);

      rerender({ selectedPath: 'docs/guide.pdf', resourceKey: otherSkill });

      expect(openAttachmentCanvas).toHaveBeenCalledTimes(2);
      expect(openAttachmentCanvas.mock.calls[1][1]).toBe(
        scopedId(otherSkill, 'docs/guide.pdf'),
      );
    });

    it('reopens the preview when the same relative path is selected in a different bucket', async () => {
      const personal = 'my-bucket/docs-helper';
      const shared = 'other-bucket/docs-helper';
      const { rerender } = renderSync({
        selectedPath: 'docs/guide.pdf',
        resourceKey: personal,
        paths: ['docs/guide.pdf'],
      });
      await settle('docs/guide.pdf');
      expect(openAttachmentCanvas).toHaveBeenCalledTimes(1);

      rerender({ selectedPath: 'docs/guide.pdf', resourceKey: shared });

      expect(openAttachmentCanvas).toHaveBeenCalledTimes(2);
      expect(openAttachmentCanvas.mock.calls[1][1]).toBe(
        scopedId(shared, 'docs/guide.pdf'),
      );
    });
  });
});
