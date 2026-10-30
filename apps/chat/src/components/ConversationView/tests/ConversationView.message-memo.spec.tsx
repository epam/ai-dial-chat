import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import {
  MessageRole,
  type Conversation,
  type DisplayAttachment,
  type Message,
} from '@epam/ai-dial-chat-shared';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationView from '../ConversationView';

/*
 * Every mocked hook returns the same values on every call, as the real hooks
 * do, so the only thing that can re-render a message item is its own props.
 */
const mocks = vi.hoisted(() => {
  const noop = () => undefined;
  return {
    renderCountByIndex: new Map<number, number>(),
    attachmentClickByIndex: new Map<
      number,
      (attachment: DisplayAttachment, messageIndex: number) => void
    >(),
    openAttachmentCanvas: vi.fn(),
    deployments: {
      items: [{ id: 'model', displayName: 'Model', inputAttachmentTypes: [] }],
      selectedItemId: 'model',
      setSelectedItemId: noop,
      toolsets: [],
    },
    appConfig: { config: { maxAttachmentFileSizeBytes: 10000 } },
    user: { user: { bucket: 'bucket' } },
    notification: {
      showErrorNotification: noop,
      showSuccessNotification: noop,
    },
    panel: { closePanel: noop },
    sidebar: { handleClose: noop },
    shortcut: { preference: 'enter' },
    canvasResolvers: { resolvers: {}, options: {} },
    mcpHost: {},
    mcpTools: [],
    mcpCanvas: { openMcpAppCanvas: noop },
    canvas: { openCanvas: noop },
    get openCanvas() {
      return { openAttachmentCanvas: this.openAttachmentCanvas };
    },
    scroll: { setMessageRef: noop, armAnchor: noop },
    empty: {},
    skills: {
      message: '',
      messageRevision: 0,
      resetSkillMentions: noop,
      onDraftChange: noop,
    },
  };
});

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => mocks.deployments,
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => mocks.appConfig,
  useFeatureFlag: () => false,
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => mocks.user,
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => mocks.notification,
}));
vi.mock('../../../context/ConversationPanelContext', () => ({
  useConversationPanel: () => mocks.panel,
}));
vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => mocks.sidebar,
}));
vi.mock('../../../hooks/useUiFeature', () => ({
  /* Drafts stay on, as by default, so the memo check covers the draft wiring. */
  useUiFeature: (feature: string) => feature === 'conversation-drafts',
}));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));
vi.mock(
  '../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference',
  () => ({ useKeyboardShortcutPreference: () => mocks.shortcut }),
);
vi.mock('../../../hooks/attachment/useAttachmentCanvasResolvers', () => ({
  useAttachmentCanvasResolvers: () => mocks.canvasResolvers,
}));
vi.mock('../../../hooks/attachment/useMcpAppHostAdapter', () => ({
  useMcpAppHostAdapter: () => mocks.mcpHost,
}));
vi.mock('../../../server-api/mcp-apps', () => ({ mcpAppsApiClient: {} }));
vi.mock('@epam/ai-dial-chat-hooks/mcp-apps', () => ({
  useMcpAppTools: () => mocks.mcpTools,
  useOpenMcpAppCanvas: () => mocks.mcpCanvas,
}));
vi.mock('@epam/ai-dial-attachment-canvas', async (original) => ({
  ...(await original<object>()),
  useAttachmentCanvas: () => mocks.canvas,
  useOpenAttachmentCanvas: () => mocks.openCanvas,
}));
vi.mock('@epam/ai-dial-chat-hooks/scroll-anchoring', () => ({
  useConversationScroll: () => mocks.scroll,
}));
vi.mock('../../DeploymentSelector/useDeploymentSelectorOverlay', () => ({
  useDeploymentSelectorOverlay: () => mocks.empty,
}));
vi.mock('../../PromptSelector/usePromptSelectorOverlay', () => ({
  usePromptSelectorOverlay: () => mocks.empty,
}));
vi.mock('../../SkillSelector/useSkillSelectorOverlay', () => ({
  useSkillSelectorOverlay: () => mocks.skills,
}));
vi.mock('../../FooterMessage/FooterMessage', () => ({ default: () => null }));
vi.mock('../../UsageLimitsControl/UsageLimitsControl', () => ({
  default: () => null,
}));
vi.mock('../../UsageLimitBanner/UsageLimitBanner', () => ({
  default: () => null,
}));
vi.mock('../ConversationMessageItem', async () => {
  const { memo } = await import('react');
  return {
    default: memo(
      ({
        index,
        onAttachmentClick,
      }: {
        index: number;
        onAttachmentClick: (
          attachment: DisplayAttachment,
          messageIndex: number,
        ) => void;
      }) => {
        mocks.attachmentClickByIndex.set(index, onAttachmentClick);
        mocks.renderCountByIndex.set(
          index,
          (mocks.renderCountByIndex.get(index) ?? 0) + 1,
        );
        return null;
      },
    ),
  };
});

const conversation = {
  id: 'one',
  name: 'Conversation',
  messages: [],
  model: { id: 'model' },
} as unknown as Conversation;

const message = (role: MessageRole, content: string): Message => ({
  role,
  content,
  timestamp: '2026-09-30',
});

const props = {
  conversation,
  onConversationChange: vi.fn(),
  onSend: vi.fn(),
  onRegenerateMessage: vi.fn(),
  onStartEdit: vi.fn(),
  onEditMessage: vi.fn(),
  onRateMessage: vi.fn(),
  onDeleteMessage: vi.fn(),
  placeholder: 'Draft',
  initialModelId: 'model',
  stoppedGeneratingText: 'Stopped',
  isAssistantTyping: true,
};

describe('ConversationView', () => {
  beforeEach(() => {
    mocks.renderCountByIndex.clear();
    mocks.attachmentClickByIndex.clear();
    mocks.openAttachmentCanvas.mockClear();
  });

  describe('ConversationView — message item memoisation', () => {
    it('re-renders only the streaming message when a chunk replaces it', () => {
      const question = message(MessageRole.User, 'question');
      const earlier = message(MessageRole.Assistant, 'earlier answer');
      const followUp = message(MessageRole.User, 'follow-up');
      const streaming = message(MessageRole.Assistant, 'partial');
      const { rerender } = render(
        <ConversationView
          {...props}
          messages={[question, earlier, followUp, streaming]}
        />,
        { wrapper: AttachmentCanvasProvider },
      );
      mocks.renderCountByIndex.clear();

      rerender(
        <ConversationView
          {...props}
          messages={[
            question,
            earlier,
            followUp,
            { ...streaming, content: 'partial answer' },
          ]}
        />,
      );

      expect([...mocks.renderCountByIndex.keys()]).toEqual([3]);
    });
  });

  describe('ConversationView — attachment clicks', () => {
    const attachment = (id: string) => ({ id }) as DisplayAttachment;

    it('lets only the latest of two quick attachment clicks commit to the canvas', () => {
      render(
        <ConversationView
          {...props}
          isAssistantTyping={false}
          messages={[
            message(MessageRole.User, 'first'),
            message(MessageRole.User, 'second'),
          ]}
        />,
        { wrapper: AttachmentCanvasProvider },
      );

      mocks.attachmentClickByIndex.get(0)?.(attachment('a'), 0);
      mocks.attachmentClickByIndex.get(1)?.(attachment('b'), 1);

      const [
        [firstAttachment, firstKey, firstGuard],
        [, secondKey, secondGuard],
      ] = mocks.openAttachmentCanvas.mock.calls;
      expect(firstAttachment).toEqual(attachment('a'));
      expect(firstKey).toBe('0:a');
      expect(secondKey).toBe('1:b');
      expect(firstGuard()).toBe(false);
      expect(secondGuard()).toBe(true);
    });
  });
});
