import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { type DeploymentItem } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import NewConversationComposer from '../NewConversationComposer';

vi.mock('../../../hooks/useUiFeature');

vi.mock('@epam/ai-dial-conversation-input', () => ({
  ConversationInput: ({
    deployments,
    chatSettings,
    isSendDisabled,
    inputClassName,
    autoFocus,
  }: {
    deployments?: unknown[];
    chatSettings?: unknown;
    isSendDisabled?: boolean;
    inputClassName?: string;
    autoFocus?: boolean;
  }) => (
    <div data-testid="conversation-input">
      Conversation input
      <output aria-label="deployments">
        {deployments === undefined ? 'undefined' : JSON.stringify(deployments)}
      </output>
      <output aria-label="chat-settings">
        {chatSettings === undefined ? 'undefined' : 'defined'}
      </output>
      <output aria-label="send-disabled">{String(!!isSendDisabled)}</output>
      <output aria-label="input-class-name">{inputClassName ?? ''}</output>
      <output aria-label="auto-focus">{String(!!autoFocus)}</output>
    </div>
  ),
  FileDndOverlay: () => null,
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    config: { asrModelId: null, transcribeSizeLimitBytes: 5 * 1024 * 1024 },
  }),
  useFeatureFlag: () => false,
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({
    user: { bucket: 'bucket' },
  }),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(vi.fn()),
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
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.EmptyChatSettings,
    );
  });

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

  it('passes chatSettings through by default (empty-chat-settings enabled)', async () => {
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');
    expect(screen.getByLabelText('chat-settings').textContent).toBe('defined');
  });

  it('omits chatSettings when empty-chat-settings is disabled', async () => {
    mockUseUiFeature.mockReturnValue(false);
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');
    expect(screen.getByLabelText('chat-settings').textContent).toBe(
      'undefined',
    );
  });

  it('hides the model selector (omits deployments) when hide-empty-chat-change-agent is enabled', async () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideEmptyChatChangeAgent,
    );
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');
    expect(screen.getByLabelText('deployments').textContent).toBe('undefined');
  });

  it('forwards deployments when hide-empty-chat-change-agent is disabled', async () => {
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');
    expect(screen.getByLabelText('deployments').textContent).toBe(
      JSON.stringify(deployments),
    );
  });

  it('disables send when disabled-send is enabled', async () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.DisabledSend,
    );
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');
    expect(screen.getByLabelText('send-disabled').textContent).toBe('true');
  });

  it('suppresses autoFocus when skip-focus-chat-input-onload is enabled', async () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.SkipFocusChatInputOnload,
    );
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');
    expect(screen.getByLabelText('auto-focus').textContent).toBe('false');
  });

  it('auto-focuses by default (not mobile, skip-focus disabled)', async () => {
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');
    expect(screen.getByLabelText('auto-focus').textContent).toBe('true');
  });
});
