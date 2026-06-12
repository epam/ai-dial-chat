import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConversationMessageItem from '../ConversationMessageItem';

const mockHandleAttachmentClick = vi.fn();

vi.mock('../../../hooks/attachment/useAttachmentAction', () => ({
  useAttachmentAction: () => ({
    handleAttachmentClick: mockHandleAttachmentClick,
  }),
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
  thinkingLabel: 'Thinking',
  executedLabel: 'Executed',
  stepsLabel: (count: number) => `${count} Steps`,
};

afterEach(() => {
  vi.clearAllMocks();
});

// t() returns the key in tests; AttachmentsI18nKeys.Download = 'attachments.downloadFile'
const CLICK_LABEL = 'attachments.downloadFile';

describe('ConversationMessageItem — main render', () => {
  it('attachment card is clickable and fires handleAttachmentClick', () => {
    render(<ConversationMessageItem {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(CLICK_LABEL));
    expect(mockHandleAttachmentClick).toHaveBeenCalledOnce();
  });

  it('passes the correct DisplayAttachment to handleAttachmentClick', () => {
    render(<ConversationMessageItem {...defaultProps} />);
    fireEvent.click(screen.getByLabelText(CLICK_LABEL));
    expect(mockHandleAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'files/report.pdf', name: 'report.pdf' }),
    );
  });
});

describe('ConversationMessageItem — Suspense fallback', () => {
  it('fallback MessageBubble also receives onAttachmentClick', () => {
    render(
      <ConversationMessageItem
        {...defaultProps}
        editingMessageIndexes={new Set([0])}
      />,
    );
    // The fallback bubble renders while EditMessageInput suspends
    fireEvent.click(screen.getByLabelText(CLICK_LABEL));
    expect(mockHandleAttachmentClick).toHaveBeenCalledOnce();
  });
});
