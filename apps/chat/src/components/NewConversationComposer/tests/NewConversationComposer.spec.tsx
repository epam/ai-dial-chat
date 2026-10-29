import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  type DeploymentItem,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, render, screen } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentsI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig as mockUseAppConfig,
  useFeatureFlag as mockUseFeatureFlag,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import { ComposerLayout } from '../../../types/conversation-composer';
import NewConversationComposer from '../NewConversationComposer';

const {
  mockShowNotification,
  capturedInputProps,
  mockUsePageFileDrag,
  mockOpenAttachmentCanvas,
  pageDrag,
} = vi.hoisted(() => {
  const pageDrag = { isDragging: false };
  return {
    pageDrag,
    mockShowNotification: vi.fn(),
    mockOpenAttachmentCanvas: vi.fn(),
    mockUsePageFileDrag: vi.fn(
      (_isAttachmentsAllowed?: boolean, _isEnabled?: boolean) => ({
        isDragging: pageDrag.isDragging,
        pendingFiles: [] as File[],
        onFilesConsumed: () => undefined,
      }),
    ),
    capturedInputProps: {
      onSend: undefined as
        ((message: string, attachments: never[]) => Promise<void>) | undefined,
      expandLabel: undefined as string | undefined,
      clickLabel: undefined as string | undefined,
      onAttachmentClick: undefined as
        ((attachment: DisplayAttachment) => void) | undefined,
    },
  };
});

vi.mock('../../../hooks/useUiFeature');
vi.mock('../../FooterMessage/FooterMessage', () => ({
  default: () => <p>app footer</p>,
}));

vi.mock('../../UsageLimitsControl/UsageLimitsControl', () => ({
  default: ({ deploymentId }: { deploymentId?: string }) => (
    <output aria-label="usage-limits">{deploymentId}</output>
  ),
}));

vi.mock('../../UsageLimitBanner/UsageLimitBanner', () => ({
  default: ({ deploymentId }: { deploymentId?: string }) => (
    <output aria-label="usage-banner">{deploymentId}</output>
  ),
}));

vi.mock('@epam/ai-dial-conversation-input', () => ({
  UsageLimitBannerSeverity: { Warning: 'warning', Reached: 'reached' },
  ConversationInput: ({
    deployments,
    chatSettings,
    isSendDisabled,
    inputClassName,
    autoFocus,
    onSend,
    belowWelcomeSlot,
    welcomeText,
    expandLabel,
    clickLabel,
    usageLimitsSlot,
    aboveInputSlot,
    onAttachmentClick,
  }: {
    deployments?: unknown[];
    chatSettings?: unknown;
    isSendDisabled?: boolean;
    inputClassName?: string;
    autoFocus?: boolean;
    onSend?: (message: string, attachments: never[]) => Promise<void>;
    belowWelcomeSlot?: ReactNode;
    welcomeText?: string;
    expandLabel?: string;
    clickLabel?: string;
    usageLimitsSlot?: ReactNode;
    aboveInputSlot?: ReactNode;
    onAttachmentClick?: (attachment: DisplayAttachment) => void;
  }) => {
    capturedInputProps.onSend = onSend;
    capturedInputProps.onAttachmentClick = onAttachmentClick;
    capturedInputProps.expandLabel = expandLabel;
    capturedInputProps.clickLabel = clickLabel;
    return (
      <div data-testid="conversation-input">
        {belowWelcomeSlot}
        {aboveInputSlot}
        {usageLimitsSlot}
        Conversation input
        <output aria-label="deployments">
          {deployments === undefined
            ? 'undefined'
            : JSON.stringify(deployments)}
        </output>
        <output aria-label="chat-settings">
          {chatSettings === undefined ? 'undefined' : 'defined'}
        </output>
        <output aria-label="send-disabled">{String(!!isSendDisabled)}</output>
        <output aria-label="input-class-name">{inputClassName ?? ''}</output>
        <output aria-label="auto-focus">{String(!!autoFocus)}</output>
        <output aria-label="welcome-text">{welcomeText ?? 'undefined'}</output>
      </div>
    );
  },
  FileDndOverlay: () => null,
}));

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
mockUseAppConfig.mockReturnValue({
  config: { asrModelId: null, transcribeSizeLimitBytes: 5 * 1024 * 1024 },
});

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({
    user: { bucket: 'bucket' },
  }),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(mockShowNotification),
}));

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useOpenAttachmentCanvas: () => ({
      openAttachmentCanvas: mockOpenAttachmentCanvas,
    }),
  };
});

vi.mock('../../../hooks/attachment/useAttachmentCanvasResolvers', () => ({
  useAttachmentCanvasResolvers: () => ({ resolvers: {}, options: {} }),
}));

vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));

vi.mock('../../../hooks/conversation/useAudioTranscription', () => ({
  useAudioTranscription: () => ({
    isAudioMessageSupported: false,
    isVoiceRecordingSupported: false,
    handleTranscribeAudio: vi.fn(),
  }),
}));

vi.mock('../../../hooks/conversation/useChatSettingsFormLabels', () => ({
  useChatSettingsFormLabels: () => ({
    settings: 'Settings',
    savedNotification: 'Chat settings have been saved',
    responseFormatLabel: 'Response format',
    responseFormatHint: 'Applies to new and existing messages',
    responseFormatMarkdown: 'Markdown',
    responseFormatPlainText: 'Plain text',
    systemPromptLabel: 'System prompt',
    systemPromptTooltip: 'Enter a prompt',
    temperatureLabel: 'Temperature',
    temperaturePrecise: 'Precise',
    temperatureNeutral: 'Neutral',
    temperatureCreative: 'Creative',
    temperatureHint: 'Hint',
    saveLabel: 'Apply changes',
    saveDisabledTooltip: 'Please select a response format',
  }),
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

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    useAttachmentUpload: () => ({
      handleUploadAttachment: vi.fn(),
    }),
    useChatSettingsFormConfig: () => ({}),
    useAttachmentValidation: () => ({
      inputAttachmentTypes: [],
      isAttachmentsAllowed: true,
      validateAttachment: vi.fn(),
      fileAccept: undefined,
    }),
  };
});

vi.mock('@epam/ai-dial-chat-hooks/viewport-layout', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@epam/ai-dial-chat-hooks/viewport-layout')
    >();
  return {
    ...actual,
    usePageFileDrag: mockUsePageFileDrag,
  };
});

vi.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => ({
    displayName: 'Test User',
  }),
}));

const deployments: DeploymentItem[] = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
];

const agentWithDescription = {
  id: 'gpt-4o',
  displayName: 'GPT-4o',
  description:
    'Answers questions. Read [the terms](https://example.com/terms).',
} as DeploymentItemDto;

describe('NewConversationComposer', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    mockShowNotification.mockClear();
    capturedInputProps.onSend = undefined;
    capturedInputProps.expandLabel = undefined;
    capturedInputProps.clickLabel = undefined;
    capturedInputProps.onAttachmentClick = undefined;
    mockOpenAttachmentCanvas.mockClear();
    mockUsePageFileDrag.mockClear();
    pageDrag.isDragging = false;
    vi.mocked(mockUseFeatureFlag).mockReturnValue(false);
    mockUseUiFeature.mockImplementation(
      (feature) =>
        feature === OverlayFeature.EmptyChatSettings ||
        feature === OverlayFeature.ChatSettings,
    );
  });

  it('shows the usage banner instead of the usage limits control while the usageLimitsControl flag is off', async () => {
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

    expect((await screen.findByLabelText('usage-banner')).textContent).toBe(
      'gpt-4o',
    );
    expect(screen.queryByLabelText('usage-limits')).toBeNull();
  });

  it('renders the usage limits control for the selected deployment when the usageLimitsControl flag is on', async () => {
    vi.mocked(mockUseFeatureFlag).mockImplementation(
      (key) => key === 'usageLimitsControl',
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

    expect((await screen.findByLabelText('usage-limits')).textContent).toBe(
      'gpt-4o',
    );
    expect(screen.queryByLabelText('usage-banner')).toBeNull();
  });

  it('passes a translated expand label for pasted-text attachment cards', async () => {
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

    await screen.findByText('Conversation input');
    expect(capturedInputProps.expandLabel).toBe(
      AttachmentsI18nKeys.ExpandPastedText,
    );
  });

  it('lets only the latest of two quick attachment clicks commit to the canvas', async () => {
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
    await screen.findByLabelText('usage-banner');
    const first = { id: 'a' } as DisplayAttachment;
    const second = { id: 'b' } as DisplayAttachment;

    capturedInputProps.onAttachmentClick?.(first);
    capturedInputProps.onAttachmentClick?.(second);

    const [[firstAttachment, , firstGuard], [secondAttachment, , secondGuard]] =
      mockOpenAttachmentCanvas.mock.calls;
    expect(firstAttachment).toBe(first);
    expect(secondAttachment).toBe(second);
    expect(firstGuard()).toBe(false);
    expect(secondGuard()).toBe(true);
  });

  it('names composer attachment tiles after the open-in-canvas action', async () => {
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

    await screen.findByText('Conversation input');
    expect(capturedInputProps.clickLabel).toBe(ButtonsI18nKeys.OpenInCanvas);
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

  it('passes intro text and starter content into the below-welcome slot when starters-below-greeting is enabled', async () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.StartersBelowGreeting,
    );
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
    expect(input.contains(screen.getByText('Choose how to start'))).toBe(true);
    expect(input.contains(screen.getByRole('button', { name: 'Draft' }))).toBe(
      true,
    );
  });

  it('passes the greeting to the conversation input by default', async () => {
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

    const welcomeText = await screen.findByLabelText('welcome-text');
    expect(welcomeText.textContent).not.toBe('undefined');
  });

  it('omits the greeting and stays in normal flow in the embedded layout', async () => {
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn()}
          layout={ComposerLayout.Embedded}
        />
      </Suspense>,
    );

    const welcomeText = await screen.findByLabelText('welcome-text');
    expect(welcomeText.textContent).toBe('undefined');
    const region = screen.getByRole('region', {
      name: ChatI18nKeys.WelcomeScreen,
    });
    expect(region.className).not.toContain('justify-center');
    expect(region.className).not.toContain('justify-end');
    expect(screen.queryByText('app footer')).toBeNull();
  });

  it('renders the page footer in the default layout', async () => {
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

    expect(await screen.findByText('app footer')).toBeTruthy();
  });

  it('omits the greeting when hide-greeting is enabled', async () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideGreeting,
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

    const welcomeText = await screen.findByLabelText('welcome-text');
    expect(welcomeText.textContent).toBe('undefined');
  });

  it('passes chatSettings through when both chat-settings and empty-chat-settings are enabled', async () => {
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

  it('omits chatSettings when chat-settings is disabled even though empty-chat-settings is enabled', async () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.EmptyChatSettings,
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
    expect(screen.getByLabelText('chat-settings').textContent).toBe(
      'undefined',
    );
  });

  it('omits chatSettings when empty-chat-settings is disabled', async () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.ChatSettings,
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

  it('rejects page file drops with the denied overlay while the input is disabled', async () => {
    pageDrag.isDragging = true;
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          isInputDisabled
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');
    expect(mockUsePageFileDrag).toHaveBeenLastCalledWith(false, true);
    expect(screen.getByText('fileDnd.overlayDeniedTitle')).toBeTruthy();
  });

  it('accepts page file drops while the input is enabled', async () => {
    pageDrag.isDragging = true;
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
    expect(mockUsePageFileDrag).toHaveBeenLastCalledWith(true, true);
    expect(screen.getByText('basic.attachFiles')).toBeTruthy();
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

  it('renders the agent description above the input when show-agent-description is enabled', async () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.ShowAgentDescription,
    );
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          selectedDeployment={agentWithDescription}
          placeholder="Message"
          onCreateConversation={vi.fn()}
        >
          <button type="button">Draft</button>
        </NewConversationComposer>
      </Suspense>,
    );

    const link = await screen.findByRole('link', { name: 'the terms' });
    const input = screen.getByTestId('conversation-input');

    expect(link.getAttribute('href')).toBe('https://example.com/terms');
    expect(
      link.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('omits the agent description when show-agent-description is disabled', async () => {
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          selectedDeployment={agentWithDescription}
          placeholder="Message"
          onCreateConversation={vi.fn()}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');

    expect(screen.queryByRole('link', { name: 'the terms' })).toBeNull();
  });

  it('re-throws a failed conversation creation after showing the error notification', async () => {
    const failure = new Error('Internal Server Error');
    render(
      <Suspense fallback={null}>
        <NewConversationComposer
          deployments={deployments}
          selectedDeploymentId="gpt-4o"
          placeholder="Message"
          onCreateConversation={vi.fn().mockRejectedValue(failure)}
        />
      </Suspense>,
    );
    await screen.findByTestId('conversation-input');

    /*
     * ConversationInput clears the textarea and the attachment tray only when
     * onSend resolves, and restores both when it rejects. Swallowing the
     * failure here would read as a successful send and wipe an unsent draft
     * together with its attachments.
     */
    await act(async () => {
      await expect(
        capturedInputProps.onSend?.('Describe the attachment.', []),
      ).rejects.toBe(failure);
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal Server Error',
        variant: NotificationVariant.Error,
      }),
    );
  });
});
