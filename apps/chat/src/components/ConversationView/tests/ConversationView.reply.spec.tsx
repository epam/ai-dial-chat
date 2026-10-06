/* eslint-disable testing-library/no-node-access -- Native selection requires a DOM Range over rendered text. */
import { attachmentsToDtos } from '@epam/ai-dial-chat-hooks';
import {
  MessageRole,
  type Attachment,
  type Conversation,
} from '@epam/ai-dial-chat-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode, type Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationView from '../ConversationView';

const mocks = vi.hoisted(() => ({
  items: [
    {
      id: 'model',
      displayName: 'Model',
      inputAttachmentTypes: ['text/plain'],
      maxInputAttachments: 3,
    },
  ],
  notify: vi.fn(),
  maxBytes: 10000,
  deploymentConfiguration: null as {
    isChatMessageInputDisabled?: boolean;
  } | null,
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: mocks.items,
    selectedItemId: 'model',
    setSelectedItemId: vi.fn(),
    selectedDeploymentConfiguration: mocks.deploymentConfiguration,
    toolsets: [],
  }),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    config: { maxAttachmentFileSizeBytes: mocks.maxBytes },
  }),
  useFeatureFlag: () => false,
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'bucket' } }),
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({
    showErrorNotification: mocks.notify,
    showSuccessNotification: vi.fn(),
  }),
}));
vi.mock('../../../context/ConversationPanelContext', () => ({
  useConversationPanel: () => ({ closePanel: vi.fn() }),
}));
vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({ handleClose: vi.fn() }),
}));
vi.mock('../../../hooks/useUiFeature', async () => {
  const { OverlayFeature } = await import('@epam/ai-dial-chat-overlay');
  return {
    useUiFeature: (feature: string) => feature === OverlayFeature.InputFiles,
  };
});
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
    resetSkillMentions: vi.fn(),
  }),
}));
vi.mock('../../FooterMessage/FooterMessage', () => ({ default: () => null }));
vi.mock('../../UsageLimitsControl/UsageLimitsControl', () => ({
  default: () => null,
}));
vi.mock('../ConversationMessageItem', () => ({
  default: ({
    msg,
    contentRef,
  }: {
    msg: { content: string };
    contentRef: Ref<HTMLDivElement>;
  }) => <div ref={contentRef}>{msg.content}</div>,
}));

const conversation = {
  id: 'one',
  name: 'Conversation',
  messages: [],
  model: { id: 'model' },
} as unknown as Conversation;
const messages = [
  {
    role: MessageRole.Assistant,
    content: 'Selected passage',
    timestamp: '2026-09-26',
  },
];
const selectPassage = async () => {
  fireEvent.pointerDown(screen.getByText('Selected passage'));
  const range = document.createRange();
  range.selectNodeContents(screen.getByText('Selected passage'));
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent(document, new Event('selectionchange'));
  fireEvent.pointerUp(document);
  return screen.findByRole('button', { name: 'chat.reply' });
};
const defaults = {
  messages,
  conversation,
  onConversationChange: vi.fn(),
  placeholder: 'Draft',
  initialModelId: 'model',
  stoppedGeneratingText: 'Stopped',
};

beforeEach(() => {
  mocks.items[0].inputAttachmentTypes = ['text/plain'];
  mocks.items[0].maxInputAttachments = 3;
  mocks.notify.mockClear();
  mocks.maxBytes = 10000;
  mocks.deploymentConfiguration = null;
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [new DOMRect(20, 100, 150, 20)],
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 360,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 800,
  });
});
afterEach(() => {
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

describe('ConversationView Reply attachment flow', () => {
  it('rejects oversized text through the ordinary attachment validator without uploading', async () => {
    mocks.maxBytes = 4;
    const upload = vi.fn();
    render(
      <ConversationView
        {...defaults}
        onSend={vi.fn()}
        onUploadAttachment={upload}
      />,
    );
    await screen.findByRole('textbox');
    fireEvent.click(await selectPassage());
    await waitFor(() => expect(mocks.notify).toHaveBeenCalled());
    expect(upload).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: 'chat.sendMessage' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('does not insert an old upload into a different conversation', async () => {
    let finish!: (value: { url: string; name: string }) => void;
    const upload = vi.fn(
      () =>
        new Promise<{ url: string; name: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const send = vi.fn();
    const { rerender } = render(
      <ConversationView
        {...defaults}
        onSend={send}
        onUploadAttachment={upload}
      />,
    );
    await screen.findByRole('textbox');
    fireEvent.click(await selectPassage());
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    rerender(
      <ConversationView
        {...defaults}
        conversation={{ ...conversation, id: 'two' }}
        onSend={send}
        onUploadAttachment={upload}
      />,
    );
    await act(async () =>
      finish({ url: 'files/bucket/old.txt', name: 'old.txt' }),
    );
    expect(screen.queryByText('old')).toBeNull();
    expect(screen.queryByRole('button', { name: 'chat.reply' })).toBeNull();
  });

  it('keeps dropped files when Reply joins the same composer', async () => {
    const upload = vi.fn(async (attachment: Attachment) => ({
      url: `files/bucket/${attachment.name}`,
      name: attachment.name,
    }));
    const send = vi.fn();
    render(
      <ConversationView
        {...defaults}
        onSend={send}
        onUploadAttachment={upload}
      />,
    );
    await screen.findByRole('textbox');
    const reply = await selectPassage();
    const drop = new Event('drop', { bubbles: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: {
        types: ['Files'],
        files: [new File(['existing'], 'notes.txt', { type: 'text/plain' })],
      },
    });
    act(() => {
      document.dispatchEvent(drop);
      reply.click();
    });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'chat.sendMessage' })
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'chat.sendMessage' }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0][1]).toHaveLength(2);
    expect(send.mock.calls[0][1].map((a: Attachment) => a.name)).toContain(
      'notes.txt',
    );
  });
  it.each([
    { isChatMessageInputDisabled: true, isAccepted: false },
    { isChatMessageInputDisabled: false, isAccepted: true },
  ])(
    'page file drop with isChatMessageInputDisabled=$isChatMessageInputDisabled',
    async ({ isChatMessageInputDisabled, isAccepted }) => {
      mocks.deploymentConfiguration = { isChatMessageInputDisabled };
      const upload = vi.fn(async (attachment: Attachment) => ({
        url: `files/bucket/${attachment.name}`,
        name: attachment.name,
      }));
      render(
        <ConversationView
          {...defaults}
          onSend={vi.fn()}
          onUploadAttachment={upload}
        />,
      );
      await screen.findByRole('textbox');
      const dragEvent = (type: string, files: File[] = []) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', {
          value: { types: ['Files'], files },
        });
        return event;
      };
      act(() => {
        document.dispatchEvent(dragEvent('dragenter'));
      });
      expect(
        screen.getByText(
          isAccepted ? 'basic.attachFiles' : 'fileDnd.overlayDeniedTitle',
        ),
      ).toBeTruthy();
      const drop = dragEvent('drop', [
        new File(['dropped'], 'dropped.txt', { type: 'text/plain' }),
      ]);
      act(() => {
        document.dispatchEvent(drop);
      });
      /* A swallowed drop must still be cancelled, or the browser opens the file. */
      expect(drop.defaultPrevented).toBe(true);
      if (isAccepted) {
        await waitFor(() => expect(upload).toHaveBeenCalledOnce());
        expect(await screen.findByText('dropped')).toBeTruthy();
      } else {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
        });
        expect(upload).not.toHaveBeenCalled();
        expect(screen.queryByText('dropped')).toBeNull();
      }
    },
  );

  it('reuses upload failure, retry and removal without changing the draft', async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue({ url: 'files/bucket/reply.txt', name: 'reply.txt' });
    const send = vi.fn();
    render(
      <ConversationView
        {...defaults}
        onSend={send}
        onUploadAttachment={upload}
      />,
    );
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Keep draft' } });
    fireEvent.click(await selectPassage());
    const retry = await screen.findByRole('button', { name: /retry/i });
    expect(
      screen
        .getByRole('button', { name: 'chat.sendMessage' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(retry);
    await screen.findByText('reply');
    expect(upload).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => expect(screen.queryByText('reply')).toBeNull());
    expect((textarea as HTMLTextAreaElement).value).toBe('Keep draft');
    expect(send).not.toHaveBeenCalled();
  });

  it('preserves the first attachment when another Reply exceeds the count limit', async () => {
    mocks.items[0].maxInputAttachments = 1;
    const upload = vi
      .fn()
      .mockResolvedValue({ url: 'files/bucket/reply.txt', name: 'reply.txt' });
    render(
      <ConversationView
        {...defaults}
        onSend={vi.fn()}
        onUploadAttachment={upload}
      />,
    );
    await screen.findByRole('textbox');
    fireEvent.click(await selectPassage());
    await screen.findByText('reply');
    fireEvent.click(await selectPassage());
    await waitFor(() => expect(mocks.notify).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledOnce();
    expect(screen.getAllByText('reply')).toHaveLength(1);
    expect(screen.queryByText('chat.replyAttachmentAdded')).toBeNull();
  });

  it('does not offer Reply for a deployment that rejects text attachments', async () => {
    mocks.items[0].inputAttachmentTypes = ['image/png'];
    const upload = vi.fn();
    render(
      <ConversationView
        {...defaults}
        onSend={vi.fn()}
        onUploadAttachment={upload}
      />,
    );
    await screen.findByRole('textbox');
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('Selected passage'));
    window.getSelection()?.addRange(range);
    fireEvent(document, new Event('selectionchange'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(screen.queryByRole('button', { name: 'chat.reply' })).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
  it('uploads once under Strict Mode, preserves the draft and sends an ordinary URL attachment', async () => {
    const upload = vi.fn(async (attachment: Attachment) => ({
      name: attachment.name,
      url: 'files/bucket/reply.txt',
    }));
    const send = vi.fn();
    render(
      <StrictMode>
        <ConversationView
          {...defaults}
          onSend={send}
          onUploadAttachment={upload}
        />
      </StrictMode>,
    );
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'My draft' } });
    fireEvent.click(await selectPassage());
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    expect(await upload.mock.calls[0][0].file!.text()).toBe('Selected passage');
    expect((textarea as HTMLTextAreaElement).value).toBe('My draft');
    expect(document.activeElement).toBe(textarea);
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'chat.sendMessage' })
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'chat.sendMessage' }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    const [text, attachments] = send.mock.calls[0];
    expect(text).toBe('My draft');
    expect(attachmentsToDtos(attachments)).toEqual([
      {
        type: 'text/plain',
        title: expect.stringMatching(/^reply-.*\.txt$/),
        url: 'files/bucket/reply.txt',
      },
    ]);
  });

  it('blocks send during upload and restores the attachment after a rejected send', async () => {
    let finish!: (value: { url: string; name: string }) => void;
    const upload = vi.fn(
      () =>
        new Promise<{ url: string; name: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const send = vi.fn().mockRejectedValue(new Error('Rejected'));
    render(
      <ConversationView
        {...defaults}
        onSend={send}
        onUploadAttachment={upload}
      />,
    );
    await screen.findByRole('textbox');
    fireEvent.click(await selectPassage());
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    expect(
      screen
        .getByRole('button', { name: 'chat.sendMessage' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await act(async () =>
      finish({ url: 'files/bucket/reply.txt', name: 'reply.txt' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'chat.sendMessage' }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(screen.getByText('reply')).toBeTruthy();
  });

  it.each([
    { isReadOnly: true },
    { isAssistantTyping: true },
    { editingMessageIndexes: new Set([0]) },
  ])('hides Reply when the composer cannot accept it: %j', async (props) => {
    render(
      <ConversationView
        {...defaults}
        {...props}
        onSend={vi.fn()}
        onUploadAttachment={vi.fn()}
      />,
    );
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('Selected passage'));
    window.getSelection()?.addRange(range);
    fireEvent(document, new Event('selectionchange'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(screen.queryByRole('button', { name: 'chat.reply' })).toBeNull();
  });
});
