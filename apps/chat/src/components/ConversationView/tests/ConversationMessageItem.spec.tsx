import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentsI18nKeys,
  CitationsI18nKeys,
} from '../../../constants/translation-keys';
import ConversationMessageItem from '../ConversationMessageItem';

const mockHandleAttachmentClick = vi.fn();

vi.mock('../../../hooks/attachment/useAttachmentAction', () => ({
  useAttachmentAction: () => ({
    handleAttachmentClick: mockHandleAttachmentClick,
  }),
}));

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
};

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
