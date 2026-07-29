import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import * as conversationsApi from '../../../server-api/conversations.api';
import AppPreviewChat from '../AppPreviewChat';

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    config: { asrModelId: null, transcribeSizeLimitBytes: 5 * 1024 * 1024 },
  }),
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({
    user: { bucket: 'bucket' },
  }),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({
    showNotification: vi.fn(),
  }),
}));

vi.mock('../../../context/DeploymentsContext');

vi.mock('../../../hooks/conversation/useAudioTranscription', () => ({
  useAudioTranscription: () => ({
    handleUploadAudio: vi.fn(),
    handleTranscribeAudio: vi.fn(),
    isTranscriptionSupported: false,
  }),
}));

vi.mock('../../../hooks/conversation/useConversationStream', () => ({
  useConversationStream: () => ({
    startStream: vi.fn(),
    handleStop: vi.fn(),
    isStreaming: false,
    canStopStreaming: false,
  }),
}));

vi.mock('../../../hooks/conversation/useConversationHandlers', () => ({
  useConversationHandlers: () => ({
    handleSend: vi.fn(),
    handleUploadAttachment: vi.fn(),
    handleRegenerateMessage: vi.fn(),
    handleDeleteMessage: vi.fn(),
    handleConfirmDelete: vi.fn(),
    handleRateMessage: vi.fn(),
    handleStartEdit: vi.fn(),
    handleCancelEdit: vi.fn(),
    handleEditMessage: vi.fn(),
    editingMessageIndexes: new Set<number>(),
    pendingDeleteIndex: null,
    setPendingDeleteIndex: vi.fn(),
  }),
}));

vi.mock('../../../server-api/conversations.api', () => ({
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  saveConversation: vi.fn(),
}));

vi.mock('../../../components/ConversationView/ConversationView', () => ({
  default: () => <div>conversation-view</div>,
}));

vi.mock(
  '../../../components/NewConversationComposer/NewConversationComposer',
  () => ({
    default: ({
      children,
      introText,
      isInputDisabled,
      message,
    }: {
      children?: ReactNode;
      introText?: string;
      isInputDisabled?: boolean;
      message?: string;
    }) => (
      <div>
        <output aria-label="Intro text">{introText ?? ''}</output>
        <output aria-label="Input disabled">
          {String(isInputDisabled ?? false)}
        </output>
        <output aria-label="Input message">{message ?? ''}</output>
        {children}
      </div>
    ),
  }),
);

vi.mock('../../../components/StarterButtons/StarterButtons', () => ({
  default: ({
    starters,
    onSelect,
  }: {
    starters: Array<{
      const: number;
      title: string;
      'dial:widgetOptions': {
        populateText: string | null;
        submit: boolean;
        confirmationMessage: string | null;
      };
    }>;
    onSelect: (starter: {
      const: number;
      title: string;
      'dial:widgetOptions': {
        populateText: string | null;
        submit: boolean;
        confirmationMessage: string | null;
      };
    }) => void;
  }) => (
    <div>
      {starters.map((starter) => (
        <button
          key={starter.const}
          type="button"
          onClick={() => onSelect(starter)}
        >
          {starter.title}
        </button>
      ))}
    </div>
  ),
}));

describe('AppPreviewChat', () => {
  const mockUseDeployments = vi.mocked(DeploymentsContextModule.useDeployments);
  const mockCreateConversation = vi.mocked(conversationsApi.createConversation);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeployments.mockReturnValue({
      items: [
        {
          id: 'applications/bucket/My App',
          displayName: 'My App',
          type: 'application',
          conversationStarters: {
            introText: 'Choose how to start',
            autoSubmit: false,
            chatMessageInputDisabled: true,
            starters: [{ title: 'Draft', text: 'Write a draft' }],
          },
        },
      ],
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
  });

  it('renders Quick Apps starter settings in preview before a conversation exists', async () => {
    render(<AppPreviewChat appId="applications/bucket/My App" />);

    expect(screen.getByLabelText('Intro text').textContent).toBe(
      'Choose how to start',
    );
    expect(screen.getByLabelText('Input disabled').textContent).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.getByLabelText('Input message').textContent).toBe(
      'Write a draft',
    );
  });

  it('creates the conversation with the raw, unencoded app id', async () => {
    mockUseDeployments.mockReturnValue({
      items: [
        {
          id: 'applications/bucket/My App',
          displayName: 'My App',
          type: 'application',
          conversationStarters: {
            introText: 'Choose how to start',
            autoSubmit: true,
            starters: [{ title: 'Draft', text: 'Write a draft' }],
          },
        },
      ],
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
    mockCreateConversation.mockResolvedValue({
      id: 'bucket/applications/bucket/My App__1.0__Write a draft__uuid',
    } as never);

    render(<AppPreviewChat appId="applications/bucket/My App" />);

    await act(async () => {
      screen.getByRole('button', { name: 'Draft' }).click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Write a draft',
        'applications/bucket/My App',
        undefined,
      );
    });
  });
});
