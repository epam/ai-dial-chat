import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import NewConversationComposer from '../NewConversationComposer';

vi.mock('@epam/ai-dial-conversation-input', () => ({
  ConversationInput: () => (
    <div data-testid="conversation-input">Conversation input</div>
  ),
  FileDndOverlay: () => null,
}));

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

vi.mock('../../../hooks/attachment/useAttachmentValidation', () => ({
  useAttachmentValidation: () => ({
    inputAttachmentTypes: [],
    isAttachmentsAllowed: true,
    validateAttachment: vi.fn(),
    fileAccept: undefined,
  }),
}));

vi.mock('../../../hooks/attachment/useOpenAttachmentCanvas', () => ({
  useOpenAttachmentCanvas: () => ({
    openAttachmentCanvas: vi.fn(),
  }),
}));

vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));

vi.mock('../../../hooks/conversation/useAttachmentUpload', () => ({
  useAttachmentUpload: () => ({
    handleUploadAttachment: vi.fn(),
  }),
}));

vi.mock('../../../hooks/conversation/useAudioTranscription', () => ({
  useAudioTranscription: () => ({
    handleUploadAudio: vi.fn(),
    handleTranscribeAudio: vi.fn(),
    isTranscriptionSupported: false,
  }),
}));

vi.mock('../../../hooks/conversation/useChatSettingsFormConfig', () => ({
  useChatSettingsFormConfig: () => ({}),
}));

vi.mock('../../../hooks/conversation/useModelSelectorLabels', () => ({
  useModelSelectorLabels: () => ({}),
}));

vi.mock('../../../hooks/files/useDialFileManagerState', () => ({
  useDialFileManagerState: () => ({
    isOpen: false,
    openModal: vi.fn(),
    closeModal: vi.fn(),
    pendingAttachments: [],
    clearPendingAttachments: vi.fn(),
    handleAttach: vi.fn(),
  }),
}));

vi.mock(
  '../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference',
  () => ({
    useKeyboardShortcutPreference: () => ({
      preference: 'enter',
    }),
  }),
);

vi.mock('../../../hooks/usePageFileDrag', () => ({
  usePageFileDrag: () => ({
    isDragging: false,
    pendingFiles: [],
    onFilesConsumed: vi.fn(),
  }),
}));

vi.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => ({
    displayName: 'Test User',
  }),
}));

const deployments: DeploymentItem[] = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
];

describe('NewConversationComposer', () => {
  it('renders intro text and starter content below the conversation input', async () => {
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          introText="Choose how to start"
          onCreateConversation={vi.fn()}
        >
          <button type="button">Draft</button>
        </NewConversationComposer>
      </Suspense>,
    );

    const input = await screen.findByTestId('conversation-input');
    const introText = screen.getByText('Choose how to start');
    const starterButton = screen.getByRole('button', { name: 'Draft' });

    expect(
      input.compareDocumentPosition(introText) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      introText.compareDocumentPosition(starterButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
