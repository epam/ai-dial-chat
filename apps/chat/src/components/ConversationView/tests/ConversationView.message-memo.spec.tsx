import {
  MessageRole,
  type Conversation,
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
    openCanvas: { openAttachmentCanvas: noop },
    scroll: { setMessageRef: noop, armAnchor: noop },
    empty: {},
    skills: { message: '', messageRevision: 0, resetSkillMentions: noop },
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
  useUiFeature: () => false,
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
vi.mock('../ConversationMessageItem', async () => {
  const { memo } = await import('react');
  return {
    default: memo(({ index }: { index: number }) => {
      mocks.renderCountByIndex.set(
        index,
        (mocks.renderCountByIndex.get(index) ?? 0) + 1,
      );
      return null;
    }),
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

beforeEach(() => {
  mocks.renderCountByIndex.clear();
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
