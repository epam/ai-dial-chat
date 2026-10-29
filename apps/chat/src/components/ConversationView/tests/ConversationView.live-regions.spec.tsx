import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import { type Conversation } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { type ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChatI18nKeys,
  ConversationI18nKeys,
} from '../../../constants/translation-keys';
import ConversationView from '../ConversationView';

const mocks = vi.hoisted(() => ({
  items: [
    {
      id: 'model',
      displayName: 'Model',
      inputAttachmentTypes: [] as string[],
      features: { skillsSupported: false },
      isHidden: false,
    },
  ],
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: mocks.items,
    selectedItemId: 'model',
    setSelectedItemId: vi.fn(),
    selectedDeploymentConfiguration: null,
    toolsets: [],
    isLoading: false,
  }),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: { maxAttachmentFileSizeBytes: 10000 } }),
  useFeatureFlag: () => false,
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { sub: 'alice', bucket: 'bucket' } }),
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({
    showErrorNotification: vi.fn(),
    showSuccessNotification: vi.fn(),
  }),
}));
vi.mock('../../../context/ConversationPanelContext', () => ({
  useConversationPanel: () => ({ closePanel: vi.fn() }),
}));
vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({ handleClose: vi.fn() }),
}));
vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: () => false,
}));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));
vi.mock(
  '../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference',
  () => ({ useKeyboardShortcutPreference: () => ({ preference: 'enter' }) }),
);
vi.mock('../../../hooks/attachment/useAttachmentCanvasResolvers', () => ({
  useAttachmentCanvasResolvers: () => ({ resolvers: {}, options: {} }),
}));
vi.mock('../../../hooks/attachment/useMcpAppHostAdapter', () => ({
  useMcpAppHostAdapter: () => ({}),
}));
vi.mock('../../../server-api/mcp-apps', () => ({ mcpAppsApiClient: {} }));
vi.mock('@epam/ai-dial-chat-hooks/mcp-apps', () => ({
  useMcpAppTools: () => [],
  useOpenMcpAppCanvas: () => ({ openMcpAppCanvas: vi.fn() }),
}));
vi.mock('@epam/ai-dial-attachment-canvas', async (original) => ({
  ...(await original<object>()),
  useAttachmentCanvas: () => ({ openCanvas: vi.fn() }),
  useOpenAttachmentCanvas: () => ({ openAttachmentCanvas: vi.fn() }),
}));
vi.mock('@epam/ai-dial-chat-hooks/scroll-anchoring', () => ({
  useConversationScroll: () => ({ setMessageRef: vi.fn(), armAnchor: vi.fn() }),
}));
vi.mock('../../DeploymentSelector/useDeploymentSelectorOverlay', () => ({
  useDeploymentSelectorOverlay: () => ({}),
}));
vi.mock('../../PromptSelector/usePromptSelectorOverlay', () => ({
  usePromptSelectorOverlay: () => ({}),
}));
vi.mock('../../SkillSelector/useSkillSelectorOverlay', () => ({
  useSkillSelectorOverlay: () => ({
    message: '',
    messageRevision: 0,
    selectedSkills: undefined,
    seedSkillMentions: vi.fn(),
    resetSkillMentions: vi.fn(),
    onDraftChange: vi.fn(),
  }),
}));
vi.mock('../../FooterMessage/FooterMessage', () => ({ default: () => null }));
vi.mock('../../UsageLimitsControl/UsageLimitsControl', () => ({
  default: () => null,
}));
vi.mock('../../UsageLimitBanner/UsageLimitBanner', () => ({
  default: () => null,
}));
vi.mock('../ConversationMessageItem', () => ({ default: () => null }));

const conversation = {
  id: 'bucket/a',
  name: 'A',
  messages: [],
  model: { id: 'model' },
} as unknown as Conversation;

type ViewProps = ComponentProps<typeof ConversationView>;

const defaults = {
  messages: [],
  conversation,
  onConversationChange: vi.fn(),
  placeholder: 'Draft',
  initialModelId: 'model',
  stoppedGeneratingText: 'Stopped',
  onSend: vi.fn(),
};

const renderView = (props: Partial<ViewProps> = {}) => {
  const view = render(<ConversationView {...defaults} {...props} />, {
    wrapper: AttachmentCanvasProvider,
  });
  const rerenderWith = (next: Partial<ViewProps>) =>
    view.rerender(<ConversationView {...defaults} {...next} />);
  return { ...view, rerenderWith };
};

const findStatus = (text: string) =>
  screen.getAllByRole('status').find((node) => node.textContent === text);

describe('ConversationView live regions', () => {
  beforeEach(() => {
    mocks.items = [{ ...mocks.items[0], isHidden: false }];
  });

  it('keeps the model-unavailable status mounted and fills it once the selected model becomes hidden', () => {
    const { rerenderWith } = renderView();
    const statusesBefore = screen.getAllByRole('status');
    expect(
      screen.queryByText(ConversationI18nKeys.ModelUnavailableNotice),
    ).toBeNull();

    mocks.items = [{ ...mocks.items[0], isHidden: true }];
    rerenderWith({ conversation: { ...conversation } });

    const notice = findStatus(ConversationI18nKeys.ModelUnavailableNotice);
    expect(notice).toBeTruthy();
    expect(statusesBefore).toContain(notice);
  });

  it('keeps the reload status mounted and fills it when the reload error appears', () => {
    const onRetryConversationReload = vi.fn().mockResolvedValue(undefined);
    const expected = `${ChatI18nKeys.ConversationReloadErrorTitle} ${ChatI18nKeys.ConversationReloadError}`;
    const { rerenderWith } = renderView({ onRetryConversationReload });
    const statusesBefore = screen.getAllByRole('status');
    expect(findStatus(expected)).toBeUndefined();

    rerenderWith({
      onRetryConversationReload,
      hasConversationReloadError: true,
    });

    const announcement = findStatus(expected);
    expect(announcement).toBeTruthy();
    expect(statusesBefore).toContain(announcement);
    expect(
      screen.getByRole('button', {
        name: ChatI18nKeys.RetryConversationReload,
      }),
    ).toBeTruthy();
  });
});
