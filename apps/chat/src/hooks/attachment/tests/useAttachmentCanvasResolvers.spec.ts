import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
