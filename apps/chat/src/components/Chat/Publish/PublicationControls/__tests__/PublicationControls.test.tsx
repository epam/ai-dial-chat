/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/selectors';

import { PublicationControls } from '../PublicationControls';

const PUBLICATION_URL = 'publications/public/test-pub-123';
const PROMPT_1 = 'prompts/public/folder/prompt-1';
const PROMPT_2 = 'prompts/public/folder/prompt-2';
const CONVERSATION_1 = 'conversations/public/folder/conversation-1';

const mockDispatch = vi.fn();

const { mockT } = vi.hoisted(() => ({ mockT: (key: string) => key }));

vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('@/src/hooks/useScreenState', () => ({
  useScreenState: () => 'LG',
}));

vi.mock('@/src/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => selector({}),
}));

vi.mock('@/src/store/selectors', () => ({
  ConversationsSelectors: {
    selectIsConversationsStreaming: vi.fn().mockReturnValue(false),
  },
  PublicationSelectors: {
    selectResourceToReviewByReviewUrl: vi.fn(),
    selectResourcesToReviewByPublicationUrl: vi.fn(),
  },
  SettingsSelectors: {
    selectIsOverlay: vi.fn().mockReturnValue(false),
  },
}));

// Partial mock: the real package is still needed for the constants that
// @/src/utils/app/file re-exports.
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  DialNeutralButton: ({
    onClick,
    disabled,
    iconBefore: _iconBefore,
    iconAfter: _iconAfter,
    ...rest
  }: any) => <button {...rest} disabled={disabled} onClick={onClick} />,
  DialPrimaryButton: ({ onClick, disabled, label, ...rest }: any) => (
    <button {...rest} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));

const resource = (reviewUrl: string) => ({
  reviewUrl,
  publicationUrl: PUBLICATION_URL,
  reviewed: true,
});

/**
 * Reproduces the admin review flow from issue #4175: the reviewer has a chat
 * open in the background and steps through the request's resources with the
 * prev/next arrows.
 */
describe('PublicationControls – switching between review resources', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    (
      PublicationSelectors.selectResourceToReviewByReviewUrl as any
    ).mockReturnValue(resource(PROMPT_1));
  });

  const renderControls = (resources: string[]) => {
    (
      PublicationSelectors.selectResourcesToReviewByPublicationUrl as any
    ).mockReturnValue(resources.map(resource));

    render(<PublicationControls entity={{ id: PROMPT_1 } as any} />);
  };

  it('keeps the background selection when moving to another prompt', () => {
    renderControls([PROMPT_1, PROMPT_2]);

    fireEvent.click(screen.getByTestId('next-chat-review-button'));

    expect(mockDispatch).toHaveBeenCalledWith(
      PromptsActions.selectPrompt({
        promptId: PROMPT_2,
        isApproveRequiredResource: true,
      }),
    );
    // The background must not be reset back to the publication request.
    expect(mockDispatch).not.toHaveBeenCalledWith(
      ConversationsActions.selectConversations({ conversationIds: [] }),
    );
    expect(mockDispatch).not.toHaveBeenCalledWith(
      PublicationActions.selectPublication({ url: PUBLICATION_URL }),
    );
  });

  it('still resets the background when moving to a conversation', () => {
    renderControls([PROMPT_1, CONVERSATION_1]);

    fireEvent.click(screen.getByTestId('next-chat-review-button'));

    expect(mockDispatch).toHaveBeenCalledWith(
      PublicationActions.selectPublication({ url: PUBLICATION_URL }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      ConversationsActions.selectConversations({
        conversationIds: [CONVERSATION_1],
      }),
    );
  });

  it('resets the background when going back to the publication request', () => {
    renderControls([PROMPT_1, PROMPT_2]);

    fireEvent.click(screen.getByTestId('back-to-publication'));

    expect(mockDispatch).toHaveBeenCalledWith(
      PublicationActions.selectPublication({ url: PUBLICATION_URL }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      ConversationsActions.selectConversations({ conversationIds: [] }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      PromptsActions.selectPrompt({ promptId: undefined }),
    );
  });
});
