import { AttachmentContentType } from '@epam/ai-dial-attachment-canvas';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import {
  MessageBubble,
  type MessageActionsProps,
} from '@epam/ai-dial-conversation-messages';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  CitationsI18nKeys,
} from '../../../constants/translation-keys';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import ConversationMessageItem from '../ConversationMessageItem';

const mockHandleAttachmentClick = vi.fn();
const mockOpenCanvas = vi.fn();

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    useAttachmentAction: () => ({
      handleAttachmentClick: mockHandleAttachmentClick,
    }),
  };
});

vi.mock('../../../hooks/useUiFeature');

vi.mock('../../../hooks/attachment/useMcpAppHostAdapter', () => ({
  useMcpAppHostAdapter: () => ({
    apiClient: {},
    theme: 'dark',
    locale: 'en',
  }),
}));

let capturedActions: MessageActionsProps | undefined;
let capturedLabels: ComponentProps<typeof MessageBubble>['labels'] | undefined;

vi.mock('@epam/ai-dial-conversation-messages', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@epam/ai-dial-conversation-messages')
    >();
  return {
    ...actual,
    MessageBubble: (props: ComponentProps<typeof actual.MessageBubble>) => {
      capturedActions = props.actions;
      capturedLabels = props.labels;
      return <actual.MessageBubble {...props} />;
    },
  };
});

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useAttachmentCanvas: () => ({
      openCanvas: mockOpenCanvas,
      closeCanvas: vi.fn(),
    }),
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
  mcpAppCache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    getOrFetch: vi.fn(),
  },
};

beforeEach(() => {
  capturedActions = undefined;
  capturedLabels = undefined;
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

describe('ConversationMessageItem — inline citations', () => {
  it.each([false, true])(
    'opens the selected cit document and page after reload (raw format: %s)',
    async (rawFormat) => {
      const entries = [
        { id: 'first', page: 1, file: 'report.pdf' },
        { id: 'grouped', page: 2, file: 'other.pdf' },
        { id: 'grouped', page: 3, file: 'report.pdf' },
      ];
      const annotations = entries.map(({ id, page, file }, index) => ({
        index,
        target: { selector: { type: 'html_tag', tag: 'cit', id } },
        body: {
          selector: { type: 'pdf_bbox', page, x1: 0, y1: 0, x2: 0, y2: 0 },
          source: {
            type: 'attachment',
            attachment: {
              type: 'application/pdf',
              url: `https://example.com/${file}`,
            },
          },
        },
      }));
      const payload = {
        role: MessageRole.Assistant,
        content:
          'First<cit data-id="first"></cit> Group<cit data-id="grouped"></cit>',
        timestamp: '2026-09-09T07:00:00Z',
        ...(rawFormat
          ? {
              custom_fields: {
                annotations: annotations.map((a) => ({
                  ...a,
                  body: {
                    ...a.body,
                    source: {
                      type: 'attachment',
                      url: a.body.source.attachment.url,
                    },
                  },
                })),
              },
            }
          : { custom_content: { annotations } }),
      };
      const message: Message = JSON.parse(JSON.stringify(payload));
      render(
        <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
      );
      const markers = () =>
        screen.getAllByRole('button', {
          name: CitationsI18nKeys.MarkerAriaLabel,
        });
      await userEvent.click(markers()[0]);
      await userEvent.click(
        screen.getByRole('button', { name: BasicI18nKeys.Preview }),
      );
      expect(mockOpenCanvas).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://example.com/report.pdf',
          page: 1,
        }),
        expect.any(String),
      );
      await userEvent.click(markers()[1]);
      await userEvent.click(
        screen.getByRole('button', {
          name: CitationsI18nKeys.PopupNextCitation,
        }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: BasicI18nKeys.Preview }),
      );
      expect(mockOpenCanvas).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://example.com/report.pdf',
          page: 3,
          selectedHighlightId: '2',
          highlights: [
            expect.objectContaining({
              id: '2',
              bboxes: [expect.objectContaining({ page: 3 })],
            }),
          ],
        }),
        expect.any(String),
      );
    },
  );
  it('renders every matching html_tag citation in one message', () => {
    const citationIds = Array.from(
      { length: 6 },
      (_, index) => `citation-${index + 1}`,
    );
    const message: Message = {
      role: MessageRole.Assistant,
      content: citationIds
        .map(
          (citationId, index) =>
            `Fact ${index + 1}<cit data-id="${citationId}"></cit>`,
        )
        .join(' '),
      timestamp: '2026-09-08T10:16:43.739Z',
      custom_content: {
        annotations: citationIds.map((citationId) => ({
          target: {
            selector: { type: 'html_tag', tag: 'cit', id: citationId },
          },
          body: {
            title: 'shared-source.pdf',
            source: {
              type: 'attachment',
              attachment: {
                type: 'application/pdf',
                url: 'files/shared-source.pdf',
                title: 'shared-source.pdf',
              },
            },
          },
        })),
      },
    };

    render(
      <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
    );

    expect(
      screen.getAllByRole('button', {
        name: CitationsI18nKeys.MarkerAriaLabel,
      }),
    ).toHaveLength(6);
  });

  it('routes a persisted XLSX citation mislabeled as PDF to generic attachment preview', async () => {
    const onAttachmentClick = vi.fn();
    const message: Message = {
      role: MessageRole.Assistant,
      content: 'Budget<cit data-id="xlsx-1"></cit>',
      timestamp: '2026-09-08T10:16:43.739Z',
      custom_content: {
        annotations: [
          {
            target: {
              selector: { type: 'html_tag', tag: 'cit', id: 'xlsx-1' },
            },
            body: {
              title: 'budget.xlsx',
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/pdf',
                  url: 'files/account/uploads/budget.xlsx',
                  title: 'budget.xlsx',
                },
              },
            },
          },
        ],
      },
    };

    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={message}
        index={1}
        onAttachmentClick={onAttachmentClick}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: CitationsI18nKeys.MarkerAriaLabel,
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );

    expect(mockOpenCanvas).not.toHaveBeenCalled();
    expect(onAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'budget.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        url: 'files/account/uploads/budget.xlsx',
      }),
    );
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

describe('ConversationMessageItem — Markdown table actions', () => {
  const TABLE_MARKDOWN = '| Name | Value |\n| --- | --- |\n| Alpha | 1 |';

  it('passes localized table action labels to assistant tables', () => {
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={{
          role: MessageRole.Assistant,
          content: TABLE_MARKDOWN,
          timestamp: '2024-01-01T00:00:04Z',
        }}
        index={1}
      />,
    );

    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.CopyAsCsv }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.CopyAsTxt }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.CopyAsMarkdown }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.DownloadAsCsv }),
    ).toBeTruthy();
    expect(capturedLabels).toMatchObject({
      tableCopyCsvLabel: ButtonsI18nKeys.CopyAsCsv,
      tableCopyTxtLabel: ButtonsI18nKeys.CopyAsTxt,
      tableCopyMarkdownLabel: ButtonsI18nKeys.CopyAsMarkdown,
      tableCopiedLabel: ButtonsI18nKeys.Copied,
      tableDownloadCsvLabel: ButtonsI18nKeys.DownloadAsCsv,
      tableOpenInCanvasLabel: ButtonsI18nKeys.OpenInCanvas,
    });
    expect(capturedLabels?.tableScrollRegionAriaLabel).toBe(
      ChatI18nKeys.ScrollableTable,
    );
  });

  it('opens the canvas with only the selected table and a localized title when Open in Canvas is activated', () => {
    /* The action button's Tooltip mounts via floating-ui, which requires
     * IntersectionObserver — absent by default in jsdom. */
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {
          // No-op in JSDOM.
        }
        unobserve() {
          // No-op in JSDOM.
        }
        disconnect() {
          // No-op in JSDOM.
        }
      },
    );

    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={{
          role: MessageRole.Assistant,
          content: TABLE_MARKDOWN,
          timestamp: '2024-01-01T00:00:04Z',
        }}
        index={1}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.OpenInCanvas }),
    );

    expect(mockOpenCanvas).toHaveBeenCalledWith(
      {
        type: AttachmentContentType.MarkdownTable,
        text: '| Name | Value |\n| :-- | :-- |\n| Alpha | 1 |',
      },
      ChatI18nKeys.MarkdownTableTitle,
    );
    vi.unstubAllGlobals();
  });
});

describe('ConversationMessageItem — markdown file URLs', () => {
  it('rewrites DIAL file ids in assistant markdown images to download URLs', () => {
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={{
          role: MessageRole.Assistant,
          content:
            '![Silver Lake chart](files/9gRuhxHb/appdata/applications/public/pg/chart.png)',
          timestamp: '2024-01-01T00:00:02Z',
        }}
        index={1}
      />,
    );

    expect(
      screen
        .getByRole('img', { name: 'Silver Lake chart' })
        .getAttribute('src'),
    ).toBe(
      '/api/v1/files/download?bucket=9gRuhxHb&path=appdata%2Fapplications%2Fpublic%2Fpg%2Fchart.png',
    );
  });
});
