import {
  type Conversation,
  type RequestSkill,
} from '@epam/ai-dial-chat-shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationView from '../ConversationView';

const DRAFTS_KEY = 'conversationDrafts:alice';

const mocks = vi.hoisted(() => ({
  items: [
    {
      id: 'model',
      displayName: 'Model',
      inputAttachmentTypes: [] as string[],
      features: { skillsSupported: true },
    },
  ],
  seedSkillMentions: vi.fn(),
  isDeploymentsLoading: false,
  isDraftsEnabled: true,
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: mocks.items,
    selectedItemId: 'model',
    setSelectedItemId: vi.fn(),
    selectedDeploymentConfiguration: null,
    toolsets: [],
    isLoading: mocks.isDeploymentsLoading,
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
  useUiFeature: (feature: string) =>
    feature === 'conversation-drafts' && mocks.isDraftsEnabled,
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
/*
 * A stateful stand-in for the skill hook: seeding pushes the text through the
 * hook's own message channel and makes the skills the active selection, the
 * same observable contract the real hook has.
 */
vi.mock('../../SkillSelector/useSkillSelectorOverlay', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useSkillSelectorOverlay: () => {
      const [state, setState] = useState<{
        message: string;
        messageRevision: number;
        selectedSkills: RequestSkill[] | undefined;
      }>({ message: '', messageRevision: 0, selectedSkills: undefined });
      const seedSkillMentions = useCallback(
        (content: string, skills: RequestSkill[] | undefined) => {
          mocks.seedSkillMentions(content, skills);
          setState((prev) => ({
            message: content,
            messageRevision: prev.messageRevision + 1,
            selectedSkills: skills,
          }));
        },
        [],
      );
      const resetSkillMentions = useCallback(
        () => setState((prev) => ({ ...prev, selectedSkills: undefined })),
        [],
      );
      const onDraftChange = useCallback(() => undefined, []);
      return { ...state, seedSkillMentions, resetSkillMentions, onDraftChange };
    },
  };
});
vi.mock('../../FooterMessage/FooterMessage', () => ({ default: () => null }));
vi.mock('../../UsageLimitsControl/UsageLimitsControl', () => ({
  default: () => null,
}));
vi.mock('../../UsageLimitBanner/UsageLimitBanner', () => ({
  default: () => null,
}));
vi.mock('../ConversationMessageItem', () => ({ default: () => null }));

const conversationA = {
  id: 'bucket/a',
  name: 'A',
  messages: [],
  model: { id: 'model' },
} as unknown as Conversation;
const conversationB = { ...conversationA, id: 'bucket/b', name: 'B' };

type ViewProps = ComponentProps<typeof ConversationView>;

const defaults = {
  messages: [],
  conversation: conversationA,
  onConversationChange: vi.fn(),
  placeholder: 'Draft',
  initialModelId: 'model',
  stoppedGeneratingText: 'Stopped',
};

const storedDrafts = (): Record<string, { text: string; skills: unknown[] }> =>
  JSON.parse(window.sessionStorage.getItem(DRAFTS_KEY) ?? '{"drafts":{}}')
    .drafts;

const seedStoredDraft = (
  id: string,
  text: string,
  skills: RequestSkill[] = [],
) =>
  window.sessionStorage.setItem(
    DRAFTS_KEY,
    JSON.stringify({
      version: 1,
      drafts: { [id]: { text, skills, updatedAt: 1 } },
    }),
  );

describe('ConversationView drafts', () => {
  let onSend: ReturnType<typeof vi.fn<NonNullable<ViewProps['onSend']>>>;

  const renderView = (props: Partial<ViewProps> = {}) => {
    const view = render(
      <ConversationView {...defaults} onSend={onSend} {...props} />,
    );
    const rerenderWith = (next: Partial<ViewProps>) =>
      view.rerender(
        <ConversationView {...defaults} onSend={onSend} {...next} />,
      );
    return { ...view, rerenderWith };
  };

  const textbox = async () =>
    (await screen.findByRole('textbox')) as HTMLTextAreaElement;

  const switchAwayAndBack = async (
    rerenderWith: (next: Partial<ViewProps>) => void,
    props: Partial<ViewProps> = {},
  ) => {
    rerenderWith({ ...props, conversation: conversationB });
    await waitFor(async () => expect((await textbox()).value).toBe(''));
    rerenderWith({ ...props, conversation: conversationA });
  };

  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.items[0].features.skillsSupported = true;
    mocks.items[0].id = 'model';
    mocks.isDeploymentsLoading = false;
    mocks.isDraftsEnabled = true;
    mocks.seedSkillMentions.mockClear();
    onSend = vi.fn<NonNullable<ViewProps['onSend']>>(() => Promise.resolve());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('restores the draft after switching to another conversation and back', async () => {
    const user = userEvent.setup();
    const { rerenderWith } = renderView();
    await user.type(await textbox(), 'compare these two plans');

    await switchAwayAndBack(rerenderWith);

    await waitFor(async () =>
      expect((await textbox()).value).toBe('compare these two plans'),
    );
  });

  it('restores the draft after an unmount within the debounce window', async () => {
    const user = userEvent.setup();
    const view = renderView();
    await user.type(await textbox(), 'half a thought');
    view.unmount();

    renderView();

    await waitFor(async () =>
      expect((await textbox()).value).toBe('half a thought'),
    );
  });

  it('keeps a separate draft for each conversation', async () => {
    const user = userEvent.setup();
    const { rerenderWith } = renderView();
    await user.type(await textbox(), 'draft A');
    rerenderWith({ conversation: conversationB });
    await waitFor(async () => expect((await textbox()).value).toBe(''));
    await user.type(await textbox(), 'draft B');
    rerenderWith({ conversation: conversationA });

    await waitFor(async () => expect((await textbox()).value).toBe('draft A'));
    rerenderWith({ conversation: conversationB });
    await waitFor(async () => expect((await textbox()).value).toBe('draft B'));
  });

  it('keeps the composer working when sessionStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    const { rerenderWith } = renderView();
    await user.type(await textbox(), 'still typing');
    expect((await textbox()).value).toBe('still typing');

    rerenderWith({ conversation: conversationB });
    await user.type(await textbox(), 'fine');
    expect((await textbox()).value).toBe('fine');
  });

  it('leaves the input empty after a successful send', async () => {
    const user = userEvent.setup();
    const { rerenderWith } = renderView();
    await user.type(await textbox(), 'hello{Enter}');
    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());

    await switchAwayAndBack(rerenderWith);

    await act(() => Promise.resolve());
    expect((await textbox()).value).toBe('');
    expect(storedDrafts()['bucket/a']).toBeUndefined();
  });

  it('keeps the draft when the send fails', async () => {
    onSend = vi.fn<NonNullable<ViewProps['onSend']>>(() =>
      Promise.reject(new Error('network')),
    );
    const user = userEvent.setup();
    const { rerenderWith } = renderView();
    await user.type(await textbox(), 'hello{Enter}');
    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());

    await switchAwayAndBack(rerenderWith);

    await waitFor(async () => expect((await textbox()).value).toBe('hello'));
  });

  it('forgets the draft once the input is cleared', async () => {
    seedStoredDraft('bucket/a', 'saved');
    const user = userEvent.setup();
    const { rerenderWith } = renderView();
    await waitFor(async () => expect((await textbox()).value).toBe('saved'));
    await user.clear(await textbox());

    await switchAwayAndBack(rerenderWith);

    await act(() => Promise.resolve());
    expect((await textbox()).value).toBe('');
    expect(storedDrafts()['bucket/a']).toBeUndefined();
  });

  it('restores skill mentions and sends them with the message', async () => {
    const skills = [{ url: 'skills/bucket/summarize' }];
    seedStoredDraft('bucket/a', '/summarize this', skills);
    const user = userEvent.setup();
    renderView();

    await waitFor(async () =>
      expect((await textbox()).value).toBe('/summarize this'),
    );
    expect(mocks.seedSkillMentions).toHaveBeenCalledWith(
      '/summarize this',
      skills,
    );
    await user.type(await textbox(), '{Enter}');

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith('/summarize this', [], skills),
    );
  });

  it('restores only the text when the deployment does not support skills', async () => {
    mocks.items[0].features.skillsSupported = false;
    seedStoredDraft('bucket/a', '/summarize this', [
      { url: 'skills/bucket/summarize' },
    ]);
    renderView();

    await waitFor(async () =>
      expect((await textbox()).value).toBe('/summarize this'),
    );
    expect(mocks.seedSkillMentions).not.toHaveBeenCalled();
  });

  it('neither restores nor saves a draft when the conversation-drafts feature is off', async () => {
    mocks.isDraftsEnabled = false;
    seedStoredDraft('bucket/a', 'old');
    const user = userEvent.setup();
    const view = renderView();

    await user.type(await textbox(), 'new');
    expect((await textbox()).value).toBe('new');
    view.unmount();

    expect(window.sessionStorage.getItem(DRAFTS_KEY)).toBeNull();
  });

  it('waits for the deployments to load before restoring a skill draft', async () => {
    mocks.items[0].id = 'removed-model';
    mocks.isDeploymentsLoading = true;
    seedStoredDraft('bucket/a', '/summarize this', [
      { url: 'skills/bucket/summarize' },
    ]);
    const { rerenderWith } = renderView();
    expect((await textbox()).value).toBe('');

    /* A fresh prop stands in for the context update the memoised view would get. */
    mocks.isDeploymentsLoading = false;
    rerenderWith({ onConversationChange: vi.fn() });

    await waitFor(async () =>
      expect((await textbox()).value).toBe('/summarize this'),
    );
    expect(mocks.seedSkillMentions).not.toHaveBeenCalled();
  });

  it('keeps the composer and the draft when the host marks overlay content spent', async () => {
    const { rerenderWith } = renderView({
      inputContent: 'from host',
      inputContentRevision: 1,
    });
    await waitFor(async () =>
      expect((await textbox()).value).toBe('from host'),
    );

    rerenderWith({ inputContent: '', inputContentRevision: 0 });

    expect((await textbox()).value).toBe('from host');
    await waitFor(() =>
      expect(storedDrafts()['bucket/a']?.text).toBe('from host'),
    );
  });

  it('lets overlay content at mount win and become the stored draft', async () => {
    seedStoredDraft('bucket/a', 'old');
    const view = renderView({ inputContent: 'new', inputContentRevision: 1 });

    await waitFor(async () => expect((await textbox()).value).toBe('new'));
    view.unmount();
    expect(storedDrafts()['bucket/a']?.text).toBe('new');
  });

  it('restores overlay content after switching away and back', async () => {
    const overlay = { inputContent: 'from host', inputContentRevision: 1 };
    const { rerenderWith } = renderView(overlay);
    await waitFor(async () =>
      expect((await textbox()).value).toBe('from host'),
    );

    rerenderWith({ ...overlay, conversation: conversationB });
    rerenderWith({ ...overlay, conversation: conversationA });

    await waitFor(async () =>
      expect((await textbox()).value).toBe('from host'),
    );
  });
});
