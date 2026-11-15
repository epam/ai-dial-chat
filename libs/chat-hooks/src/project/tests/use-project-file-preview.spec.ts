import {
  AttachmentType,
  RequestStatus,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadProjectFileAttachment,
  toProjectOutputCardId,
  toProjectPreviewKey,
} from '../project-file-preview';
import {
  useProjectFilePreview,
  type UseProjectFilePreviewOptions,
} from '../use-project-file-preview';

vi.mock('../project-file-preview', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../project-file-preview')>()),
  downloadProjectFileAttachment: vi.fn(() => true),
}));

const SCOPE = 'projects/b/q4';

const attachment = (name: string): DisplayAttachment => ({
  id: name,
  name,
  contentType: 'text/csv',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  url: `${SCOPE}/${name}`,
});

const key = (cardId: string) => toProjectPreviewKey(SCOPE, cardId);

const openAttachment = vi.fn();
const closeCanvas = vi.fn();
const guard = vi.fn(() => true);
const startRequest = vi.fn(() => guard);
const resolveContextAttachment = vi.fn((cardId: string) =>
  cardId === 'missing.csv' ? undefined : attachment(cardId),
);
const resolveOutputAttachment = vi.fn((name: string) => attachment(name));

const render = (overrides: Partial<UseProjectFilePreviewOptions> = {}) =>
  renderHook(
    (props: Partial<UseProjectFilePreviewOptions>) =>
      useProjectFilePreview({
        scope: SCOPE,
        attachmentId: undefined,
        openAttachment,
        closeCanvas,
        startRequest,
        resolveContextAttachment,
        resolveOutputAttachment,
        ...props,
      }),
    { initialProps: overrides },
  );

describe('useProjectFilePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('selection', () => {
    it('selects the context card whose key the canvas holds', () => {
      const { result } = render({ attachmentId: key('tickets.csv') });

      expect(result.current.selectedCardId).toBe('tickets.csv');
      expect(result.current.selectedContextFileId).toBe('tickets.csv');
      expect(result.current.selectedOutputName).toBeUndefined();
    });

    it('selects an output, and no context card, for an output key', () => {
      const { result } = render({
        attachmentId: key(toProjectOutputCardId('deck.pptx')),
      });

      expect(result.current.selectedCardId).toBe('artifacts/deck.pptx');
      expect(result.current.selectedOutputName).toBe('deck.pptx');
      expect(result.current.selectedContextFileId).toBeUndefined();
    });

    it.each([
      [
        'another project',
        toProjectPreviewKey('projects/b/other', 'tickets.csv'),
      ],
      ['a conversation attachment', '0:abc'],
    ])('selects nothing when the canvas holds %s', (_, attachmentId) => {
      const { result } = render({ attachmentId });

      expect(result.current.selectedCardId).toBeUndefined();
    });
  });

  describe('context cards', () => {
    it('opens the card under its scoped key with a fresh commit guard', () => {
      const { result } = render();

      result.current.onContextFileClick('tickets.csv');

      expect(startRequest).toHaveBeenCalledOnce();
      expect(openAttachment).toHaveBeenCalledWith(
        attachment('tickets.csv'),
        key('tickets.csv'),
        guard,
      );
      expect(closeCanvas).not.toHaveBeenCalled();
    });

    it('switches to another card', () => {
      const { result } = render({ attachmentId: key('tickets.csv') });

      result.current.onContextFileClick('report.pdf');

      expect(openAttachment).toHaveBeenCalledWith(
        attachment('report.pdf'),
        key('report.pdf'),
        guard,
      );
      expect(closeCanvas).not.toHaveBeenCalled();
    });

    it('closes the canvas when the open card is activated again', () => {
      const { result } = render({ attachmentId: key('tickets.csv') });

      result.current.onContextFileClick('tickets.csv');

      expect(closeCanvas).toHaveBeenCalledOnce();
      expect(openAttachment).not.toHaveBeenCalled();
      expect(startRequest).not.toHaveBeenCalled();
    });

    it('leaves the canvas as it was for a card that resolves to nothing', () => {
      const { result } = render({ attachmentId: key('tickets.csv') });

      result.current.onContextFileClick('missing.csv');

      expect(openAttachment).not.toHaveBeenCalled();
      expect(closeCanvas).not.toHaveBeenCalled();
      expect(startRequest).not.toHaveBeenCalled();
    });

    it('hands the host guard through so a superseded request can refuse to commit', () => {
      guard.mockReturnValueOnce(false);
      const { result } = render();

      result.current.onContextFileClick('tickets.csv');

      const passed = openAttachment.mock.calls[0][2] as () => boolean;
      expect(passed()).toBe(false);
    });
  });

  describe('output cards', () => {
    it('opens an output under the key built from its card id', () => {
      const { result } = render();

      result.current.onOutputClick('deck.pptx');

      expect(openAttachment).toHaveBeenCalledWith(
        attachment('deck.pptx'),
        key('artifacts/deck.pptx'),
        guard,
      );
    });

    it('closes the canvas when the open output is activated again', () => {
      const { result } = render({
        attachmentId: key('artifacts/deck.pptx'),
      });

      result.current.onOutputClick('deck.pptx');

      expect(closeCanvas).toHaveBeenCalledOnce();
      expect(openAttachment).not.toHaveBeenCalled();
    });
  });

  describe('closeIfRemoved', () => {
    it('closes the canvas when the open card is no longer in the list', () => {
      const { result } = render({ attachmentId: key('tickets.csv') });

      result.current.closeIfRemoved([{ id: 'report.pdf' }]);

      expect(closeCanvas).toHaveBeenCalledOnce();
    });

    it('keeps the canvas open while the open card is still in the list', () => {
      const { result } = render({ attachmentId: key('tickets.csv') });

      result.current.closeIfRemoved([{ id: 'tickets.csv' }, { id: 'a.pdf' }]);

      expect(closeCanvas).not.toHaveBeenCalled();
    });

    it('does nothing while no context card is open', () => {
      const { result } = render({
        attachmentId: key('artifacts/deck.pptx'),
      });

      result.current.closeIfRemoved([]);

      expect(closeCanvas).not.toHaveBeenCalled();
    });
  });

  describe('onContextFileDownload', () => {
    it('downloads the attachment the host resolves for the card through the host resolver', () => {
      const resolveDownloadUrl = vi.fn();
      const { result } = render({ resolveDownloadUrl });

      result.current.onContextFileDownload('tickets.csv');

      expect(resolveContextAttachment).toHaveBeenCalledWith('tickets.csv');
      expect(downloadProjectFileAttachment).toHaveBeenCalledWith(
        attachment('tickets.csv'),
        resolveDownloadUrl,
      );
      expect(openAttachment).not.toHaveBeenCalled();
      expect(closeCanvas).not.toHaveBeenCalled();
    });

    it('ignores a card the host resolves to nothing', () => {
      const { result } = render();

      result.current.onContextFileDownload('missing.csv');

      expect(downloadProjectFileAttachment).not.toHaveBeenCalled();
    });
  });

  describe('callback identity', () => {
    it('keeps its callbacks across re-renders with unchanged inputs', () => {
      const { result, rerender } = render({ attachmentId: key('a.csv') });
      const before = result.current;

      rerender({ attachmentId: key('a.csv') });

      expect(result.current.onContextFileClick).toBe(before.onContextFileClick);
      expect(result.current.onOutputClick).toBe(before.onOutputClick);
      expect(result.current.closeIfRemoved).toBe(before.closeIfRemoved);
      expect(result.current.onContextFileDownload).toBe(
        before.onContextFileDownload,
      );
    });
  });
});
