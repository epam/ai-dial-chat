import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import type { MessageActionsProps } from '@epam/ai-dial-conversation-messages';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentsI18nKeys,
  CitationsI18nKeys,
} from '../../../constants/translation-keys';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import ConversationMessageItem from '../ConversationMessageItem';

const mockHandleAttachmentClick = vi.fn();

vi.mock('../../../hooks/attachment/useAttachmentAction', () => ({
  useAttachmentAction: () => ({
    handleAttachmentClick: mockHandleAttachmentClick,
  }),
}));

vi.mock('../../../hooks/useUiFeature');

let capturedActions: MessageActionsProps | undefined;

vi.mock('@epam/ai-dial-conversation-messages', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@epam/ai-dial-conversation-messages')
    >();
  return {
    ...actual,
    MessageBubble: (props: ComponentProps<typeof actual.MessageBubble>) => {
      capturedActions = props.actions;
      return <actual.MessageBubble {...props} />;
    },
  };
});

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useAttachmentCanvas: () => ({ openCanvas: vi.fn(), closeCanvas: vi.fn() }),
  };
});

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'dark' }),
}));

vi.mock('@epam/ai-dial-conversation-stages', () => ({
  StagesPanel: () => null,
}));

vi.mock('@epam/ai-dial-conversation-input', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    EditMessageInput: () => {
      // Always suspend so the Suspense fallback MessageBubble is rendered
      throw new Promise((_resolve) => undefined);
    },
  };
});

const USER_MESSAGE: Message = {
  role: MessageRole.User,
  content: 'Hello',
  timestamp: '2024-01-01T00:00:00Z',
  custom_content: {
    attachments: [
      { title: 'report.pdf', type: 'application/pdf', url: 'files/report.pdf' },
    ],
  },
};

const defaultProps = {
  msg: USER_MESSAGE,
  index: 0,
  totalCount: 2,
  isAssistantTyping: false,
  deploymentLookup: {},
  tooltips: {},
  ariaLabels: {},
  cancelLabel: 'Cancel',
  saveLabel: 'Save',
  editMessageAriaLabel: 'Edit message',
  quickReplyButtonsAriaLabel: 'Quick reply',
  showMoreLabel: 'Show more',
  showLessLabel: 'Show less',
  showMoreUserMessageAriaLabel: 'Show more',
  showLessUserMessageAriaLabel: 'Show less',
  statusModelChangedTitle: 'Model switched.',
  formatStatusModelChangedBody: () => '',
  streamErrorText: 'Stream error',
  stoppedGeneratingText: 'Stopped generating',
  thinkingLabel: 'Thinking',
  executedLabel: 'Executed',
  stepsLabel: (count: number) => `${count} Steps`,
  mcpAppTools: [],
};

beforeEach(() => {
  vi.mocked(useUiFeatureModule.useUiFeature).mockImplementation(
    (feature) =>
      feature !== OverlayFeature.HideEditUserMessage &&
      feature !== OverlayFeature.HideRegenerateAssistantMessage &&
      feature !== OverlayFeature.HideDeleteUserMessage,
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ConversationMessageItem — reference-only attachments', () => {
  const ASSISTANT_WITH_REFERENCE: Message = {
    role: MessageRole.Assistant,
    content: 'Dinosaurs first appeared in the Triassic.',
    timestamp: '2024-01-01T00:00:02Z',
    custom_content: {
      attachments: [
        {
          title: 'livescience.com',
          type: 'text/markdown',
          data: 'Dinosaurs first appeared in the Triassic Period.',
          reference_url: 'https://example.com/redirect/a',
          reference_type: 'text/markdown',
        },
      ],
    },
  };

  it('excludes the reference-only attachment from the tray', () => {
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={ASSISTANT_WITH_REFERENCE}
        index={1}
      />,
    );
    expect(screen.queryByLabelText(AttachmentsI18nKeys.Download)).toBeNull();
  });

  it('renders a chip for the reference group', () => {
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={ASSISTANT_WITH_REFERENCE}
        index={1}
      />,
    );
    expect(
      screen.getByRole('button', { name: CitationsI18nKeys.MarkerAriaLabel }),
    ).toBeTruthy();
  });
});

describe('ConversationMessageItem — stopped generation', () => {
  const STOPPED_EMPTY_ASSISTANT: Message = {
    role: MessageRole.Assistant,
    content: '',
    timestamp: '2024-01-01T00:00:01Z',
    wasStoppedByUser: true,
  };

  it('shows the stopped-generating label for an empty stopped assistant message', () => {
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={STOPPED_EMPTY_ASSISTANT}
        index={1}
      />,
    );
    expect(screen.getByText('Stopped generating')).toBeTruthy();
  });

  it('shows the partial content (not the stopped label) when a stopped message has text', () => {
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={{ ...STOPPED_EMPTY_ASSISTANT, content: 'Partial answer' }}
        index={1}
      />,
    );
    expect(screen.getByText('Partial answer')).toBeTruthy();
    expect(screen.queryByText('Stopped generating')).toBeNull();
  });
});

describe('ConversationMessageItem — message action gates', () => {
  const ASSISTANT_MESSAGE: Message = {
    role: MessageRole.Assistant,
    content: 'Hello there',
    timestamp: '2024-01-01T00:00:03Z',
  };

  it('includes edit/delete for a user message and like/dislike for an assistant message by default', () => {
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={USER_MESSAGE}
        onStartEdit={vi.fn()}
        onDeleteMessage={vi.fn()}
      />,
    );
    expect(capturedActions?.onEdit).toBeDefined();
    expect(capturedActions?.onDelete).toBeDefined();

    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={ASSISTANT_MESSAGE}
        index={1}
        onRegenerateMessage={vi.fn()}
        onRateMessage={vi.fn()}
        onDislikeMessage={vi.fn()}
      />,
    );
    expect(capturedActions?.onRegenerate).toBeDefined();
    expect(capturedActions?.onLike).toBeDefined();
    expect(capturedActions?.onDislike).toBeDefined();
  });

  it('omits onEdit when hide-edit-user-message is enabled', () => {
    vi.mocked(useUiFeatureModule.useUiFeature).mockImplementation(
      (feature) => feature === OverlayFeature.HideEditUserMessage,
    );
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={USER_MESSAGE}
        onStartEdit={vi.fn()}
      />,
    );
    expect(capturedActions?.onEdit).toBeUndefined();
  });

  it('omits onDelete when hide-delete-user-message is enabled', () => {
    vi.mocked(useUiFeatureModule.useUiFeature).mockImplementation(
      (feature) => feature === OverlayFeature.HideDeleteUserMessage,
    );
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={USER_MESSAGE}
        onDeleteMessage={vi.fn()}
      />,
    );
    expect(capturedActions?.onDelete).toBeUndefined();
  });

  it('omits onRegenerate when hide-regenerate-assistant-message is enabled', () => {
    vi.mocked(useUiFeatureModule.useUiFeature).mockImplementation(
      (feature) => feature === OverlayFeature.HideRegenerateAssistantMessage,
    );
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={ASSISTANT_MESSAGE}
        onRegenerateMessage={vi.fn()}
      />,
    );
    expect(capturedActions?.onRegenerate).toBeUndefined();
  });

  it('omits onLike and onDislike when likes is disabled', () => {
    vi.mocked(useUiFeatureModule.useUiFeature).mockImplementation(
      (feature) => feature !== OverlayFeature.Likes,
    );
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={ASSISTANT_MESSAGE}
        onRateMessage={vi.fn()}
        onDislikeMessage={vi.fn()}
      />,
    );
    expect(capturedActions?.onLike).toBeUndefined();
    expect(capturedActions?.onDislike).toBeUndefined();
  });
});
