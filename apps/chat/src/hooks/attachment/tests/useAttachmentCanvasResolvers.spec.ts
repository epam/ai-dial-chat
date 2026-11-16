import { AttachmentContentType } from '@epam/ai-dial-attachment-canvas';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttachmentCanvasResolvers } from '../useAttachmentCanvasResolvers';

const mocks = vi.hoisted(() => ({
  closeSourcesPanel: vi.fn(),
  closePanel: vi.fn(),
}));

vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({ handleClose: mocks.closeSourcesPanel }),
}));

vi.mock('../../../context/ConversationPanelContext', () => ({
  useConversationPanel: () => ({ closePanel: mocks.closePanel }),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'dark' }),
}));

vi.mock('../useCustomVisualizers', () => ({
  useCustomVisualizers: () => [],
}));

describe('useAttachmentCanvasResolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes the sources panel before the canvas opens', () => {
    const { result } = renderHook(() => useAttachmentCanvasResolvers());

    result.current.options.onBeforeOpen?.();

    expect(mocks.closeSourcesPanel).toHaveBeenCalledOnce();
  });

  it('leaves the navigation sidebar as the user set it', () => {
    const { result } = renderHook(() => useAttachmentCanvasResolvers());

    result.current.options.onBeforeOpen?.();

    expect(mocks.closePanel).not.toHaveBeenCalled();
  });

  describe('a generated file in a project conversation', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('fetches the Core-encoded artifact id once, without encoding it twice', async () => {
      const fetchMock = vi.fn(
        async () => new Response('# Report', { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const { result } = renderHook(() => useAttachmentCanvasResolvers());

      const content = await result.current.resolvers.resolveMarkdownContent({
        id: 'attachment-1',
        name: 'report v2.md',
        contentType: 'text/markdown',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        url: 'projects/a1b2c3/Q4%20launch/files/artifacts/report%20v2.md',
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/projects/projects%2Fa1b2c3%2FQ4%20launch/artifacts/report%20v2.md',
      );
      expect(content).toEqual({
        type: AttachmentContentType.Markdown,
        text: '# Report',
      });
    });
  });
});
