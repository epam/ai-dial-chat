import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import {
  MessageRole,
  type Conversation,
  type Message,
} from '@epam/ai-dial-chat-shared';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationView from '../ConversationView';

/*
 * Same hook mocks as ConversationView.message-memo.spec.tsx. The message item
 * is replaced by a probe recording the `hasTimestamp` flag each message
 * receives; rendering the time itself is covered by MessageTimestamp.spec.tsx.
 */
const mocks = vi.hoisted(() => {
  const noop = () => undefined;
  return {
    hasTimestampByIndex: new Map<number, boolean | undefined>(),
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
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
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
      ({ index, hasTimestamp }: { index: number; hasTimestamp?: boolean }) => {
        mocks.hasTimestampByIndex.set(index, hasTimestamp);
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

const message = (
  role: MessageRole,
  content: string,
  timestamp = '2026-09-30T10:15:00.000Z',
): Message => ({ role, content, timestamp });

const props = {
  conversation,
  onConversationChange: vi.fn(),
  onSend: vi.fn(),
  placeholder: 'Draft',
  initialModelId: 'model',
  stoppedGeneratingText: 'Stopped',
};

const messages = [
  message(MessageRole.User, 'question'),
  message(MessageRole.Assistant, 'answer'),
  message(MessageRole.User, 'follow-up'),
];

describe('ConversationView — message timestamps', () => {
  beforeEach(() => {
    mocks.hasTimestampByIndex.clear();
  });

  it('asks every message item for its send time when hasMessageTimestamps is set', () => {
    render(
      <ConversationView {...props} messages={messages} hasMessageTimestamps />,
      { wrapper: AttachmentCanvasProvider },
    );

    expect([...mocks.hasTimestampByIndex.entries()]).toEqual([
      [0, true],
      [1, true],
      [2, true],
    ]);
  });

  it('leaves send times off by default', () => {
    render(<ConversationView {...props} messages={messages} />, {
      wrapper: AttachmentCanvasProvider,
    });

    expect([...mocks.hasTimestampByIndex.values()]).toEqual([
      false,
      false,
      false,
    ]);
  });
});
