import { ShareLinkAccess, type SharePopoverProps } from '@epam/ai-dial-share';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useShareLinkModule from '../../../hooks/useShareLink/useShareLink';
import ShareConversationPopoverContainer from '../ShareConversationPopoverContainer';

const { mockSharePopover } = vi.hoisted(() => ({
  mockSharePopover: vi.fn((_props: SharePopoverProps) => null),
}));

vi.mock('../../../hooks/useShareLink/useShareLink');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@epam/ai-dial-share', () => ({
  ShareLinkAccess: { View: 'view', Edit: 'edit' },
  SharePopover: mockSharePopover,
}));

const mockUseShareLink = (
  overrides: Partial<ReturnType<typeof useShareLinkModule.useShareLink>> = {},
) => {
  vi.mocked(useShareLinkModule.useShareLink).mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    setAccess: vi.fn(),
    ...overrides,
  });
};

describe('ShareConversationPopoverContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls useShareLink with the conversation path and wires the result to SharePopover', () => {
    mockUseShareLink({
      data: {
        url: 'https://example.com/conversations/share/path-1',
        expiresInDays: 3,
        access: [ShareLinkAccess.View],
      },
    });

    render(
      <ShareConversationPopoverContainer
        conversationPath="path-1"
        onClose={vi.fn()}
      />,
    );

    expect(useShareLinkModule.useShareLink).toHaveBeenCalledWith('path-1');

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/conversations/share/path-1',
        isLoading: false,
        error: null,
        access: [ShareLinkAccess.View],
        canEditAccess: false,
      }),
      undefined,
    );
  });

  it('renders with canEditAccess false regardless of the conversation', () => {
    mockUseShareLink();

    render(
      <ShareConversationPopoverContainer
        conversationPath="path-2"
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAccess: false }),
      undefined,
    );
  });

  it('shows the loading state while the link is being created', () => {
    mockUseShareLink({ isLoading: true });

    render(
      <ShareConversationPopoverContainer
        conversationPath="path-3"
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({ isLoading: true, url: undefined }),
      undefined,
    );
  });

  it('shows the error state when link creation fails', () => {
    const error = new Error('failed');
    mockUseShareLink({ error });

    render(
      <ShareConversationPopoverContainer
        conversationPath="path-4"
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({ error }),
      undefined,
    );
  });

  it('passes onClose through to SharePopover', () => {
    mockUseShareLink();
    const onClose = vi.fn();

    render(
      <ShareConversationPopoverContainer
        conversationPath="path-5"
        onClose={onClose}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({ onClose }),
      undefined,
    );
  });
});
