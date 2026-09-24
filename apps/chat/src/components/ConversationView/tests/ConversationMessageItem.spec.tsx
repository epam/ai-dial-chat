import { AttachmentContentType } from '@epam/ai-dial-attachment-canvas';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  MessageRole,
  type ApplicationVisualizer,
  type ApplicationVisualizerRegistry,
  type Message,
} from '@epam/ai-dial-chat-shared';
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

let isMobileMock = false;

vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => isMobileMock,
}));

let applicationVisualizersMock: ApplicationVisualizerRegistry = {};

vi.mock('../../../hooks/attachment/useApplicationVisualizers', () => ({
  useApplicationVisualizers: () => applicationVisualizersMock,
}));

/* The real connector mounts an iframe and subscribes to window messages; the
 * handshake never settles in jsdom, so the inline frame would sit in its
 * loading state. Only the surface around it is under test here. */
vi.mock('@epam/ai-dial-visualizer-connector', () => ({
  VisualizerConnector: vi.fn().mockImplementation(function (root: HTMLElement) {
    root.appendChild(document.createElement('iframe'));
    return {
      ready: () => new Promise(() => undefined),
      send: vi.fn(),
      destroy: vi.fn(),
    };
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
  applicationVisualizersMock = {};
  isMobileMock = false;
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
  it.each([
    ['text/html', 'https://example.com/page.html'],
    ['text/html', 'files/bucket/page.html'],
    ['application/pdf', 'https://example.com/report.pdf'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'https://example.com/report.docx',
    ],
  ])('keeps Preview for a supported citation: %s %s', async (type, url) => {
    const message: Message = {
      role: MessageRole.Assistant,
      content: 'Source<cit data-id="123"></cit>',
      timestamp: '2026-09-21T13:47:50Z',
      custom_content: {
        annotations: [
          {
            target: { selector: { type: 'html_tag', tag: 'cit', id: '123' } },
            body: {
              source: { type: 'attachment', attachment: { type, url } },
            },
          },
        ],
      },
    };
    const onAttachmentClick = vi.fn();
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={message}
        index={1}
        onAttachmentClick={onAttachmentClick}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: CitationsI18nKeys.MarkerAriaLabel }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );
    if (type === 'text/html') {
      expect(onAttachmentClick).toHaveBeenCalledWith(
        expect.objectContaining({ url, contentType: type }),
        1,
      );
    } else {
      expect(mockOpenCanvas).toHaveBeenCalledWith(
        expect.objectContaining({ url }),
        expect.any(String),
      );
    }
  });

  it.each([false, true])(
    'offers only Open in browser for an external web citation (mobile: %s)',
    async (isMobile) => {
      isMobileMock = isMobile;
      const url = 'https://data.imf.org/en/datasets/IMF.RES:WEO';
      const message: Message = {
        role: MessageRole.Assistant,
        content:
          'Inflation in 2026 increased, as reported by IMF:WEO dataset <cit data-id="123"></cit>',
        timestamp: '2026-09-21T13:47:50Z',
        custom_content: {
          annotations: [
            {
              index: 0,
              target: { selector: { type: 'html_tag', tag: 'cit', id: '123' } },
              body: {
                title: 'World Economic Outlook',
                source: {
                  type: 'attachment',
                  attachment: {
                    type: 'text/html',
                    url,
                    title: 'World Economic Outlook dataset',
                  },
                },
              },
            },
          ],
        },
      };
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      try {
        render(
          <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
        );
        await userEvent.click(
          screen.getByRole('button', {
            name: CitationsI18nKeys.MarkerAriaLabel,
          }),
        );
        expect(
          screen.queryByRole('button', { name: BasicI18nKeys.Preview }),
        ).toBeNull();
        await userEvent.click(
          screen.getByRole('button', {
            name: CitationsI18nKeys.PopupOpenInBrowser,
          }),
        );
        expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
        expect(mockOpenCanvas).not.toHaveBeenCalled();
      } finally {
        open.mockRestore();
      }
    },
  );

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

  it('opens a persisted XLSX citation mislabeled as PDF in the OOXML canvas with no highlight, rather than falling through to generic attachment preview', async () => {
    /*
     * Before Office citation highlighting existed, every non-PDF citation
     * fell through to the plain-attachment path. This citation carries no
     * selector at all (a legacy annotation, or one the backend previously
     * stripped) — per design.md's acceptance criteria, a missing selector
     * still opens the Office document, just with no highlight, rather than
     * falling through.
     */
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

    expect(onAttachmentClick).not.toHaveBeenCalled();
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AttachmentContentType.Ooxml,
        format: 'xlsx',
      }),
      'budget.xlsx',
    );
    expect(mockOpenCanvas.mock.calls[0][0]).not.toHaveProperty('highlights');
  });

  it('opens a DOCX citation in the OOXML canvas with the right format and the clicked annotation selected', async () => {
    const message: Message = {
      role: MessageRole.Assistant,
      content: 'Fact<cit data-id="docx-1"></cit>',
      timestamp: '2026-09-10T10:00:00Z',
      custom_content: {
        annotations: [
          {
            target: {
              selector: { type: 'html_tag', tag: 'cit', id: 'docx-1' },
            },
            body: {
              title: 'report.docx',
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  url: 'files/account/uploads/report.docx',
                  title: 'report.docx',
                },
              },
              selector: [
                {
                  type: 'docx_text_range',
                  story: 'body',
                  path: [3, 1],
                  start: 0,
                  end: 5,
                  text: 'Hello',
                },
              ],
            },
          },
        ],
      },
    };

    render(
      <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: CitationsI18nKeys.MarkerAriaLabel }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );

    /* The single annotation carries no `index`, so its highlight id is
       derived from its own identity (cit id + selector digest) rather than
       a fixed position — assert the shape, not a pinned literal (#8907). */
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AttachmentContentType.Ooxml,
        format: 'docx',
        highlights: [expect.objectContaining({ id: expect.any(String) })],
        selectedHighlightId: expect.any(String),
      }),
      'report.docx',
    );
    const [call] = mockOpenCanvas.mock.calls;
    const content = call[0] as {
      highlights: { id: string }[];
      selectedHighlightId: string;
    };
    expect(content.selectedHighlightId).toBe(content.highlights[0].id);
  });

  it('previews the second annotation of a grouped Office citation, not the group primary', async () => {
    const url = 'files/account/uploads/report.docx';
    const makeDocxSelector = (start: number, text: string) => [
      {
        type: 'docx_text_range',
        story: 'body',
        path: [start],
        start: 0,
        end: text.length,
        text,
      },
    ];
    const message: Message = {
      role: MessageRole.Assistant,
      content: 'Group<cit data-id="grouped"></cit>',
      timestamp: '2026-09-10T10:00:00Z',
      custom_content: {
        annotations: [
          {
            index: 0,
            target: {
              selector: { type: 'html_tag', tag: 'cit', id: 'grouped' },
            },
            body: {
              title: 'report.docx',
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  url,
                  title: 'report.docx',
                },
              },
              selector: makeDocxSelector(3, 'First'),
            },
          },
          {
            index: 1,
            target: {
              selector: { type: 'html_tag', tag: 'cit', id: 'grouped' },
            },
            body: {
              title: 'report.docx',
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  url,
                  title: 'report.docx',
                },
              },
              selector: makeDocxSelector(7, 'Second'),
            },
          },
        ],
      },
    };

    render(
      <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: CitationsI18nKeys.MarkerAriaLabel }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: CitationsI18nKeys.PopupNextCitation }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );

    expect(mockOpenCanvas).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedHighlightId: '1' }),
      'report.docx',
    );
  });

  it('opens an Office citation with an unresolvable selector rather than falling through to the plain-attachment path', async () => {
    const onAttachmentClick = vi.fn();
    const message: Message = {
      role: MessageRole.Assistant,
      content: 'Fact<cit data-id="docx-bad"></cit>',
      timestamp: '2026-09-10T10:00:00Z',
      custom_content: {
        annotations: [
          {
            target: {
              selector: { type: 'html_tag', tag: 'cit', id: 'docx-bad' },
            },
            body: {
              title: 'report.docx',
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  url: 'files/account/uploads/report.docx',
                  title: 'report.docx',
                },
              },
              selector: [
                {
                  type: 'docx_text_range',
                  story: 'body',
                  path: [3, 1],
                  start: 5,
                  end: 3,
                  text: 'Hello',
                },
              ],
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
      screen.getByRole('button', { name: CitationsI18nKeys.MarkerAriaLabel }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );

    expect(onAttachmentClick).not.toHaveBeenCalled();
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ type: AttachmentContentType.Ooxml }),
      'report.docx',
    );
  });

  it('falls through a CSV citation to generic attachment preview, unchanged', async () => {
    const onAttachmentClick = vi.fn();
    const message: Message = {
      role: MessageRole.Assistant,
      content: 'Data<cit data-id="csv-1"></cit>',
      timestamp: '2026-09-10T10:00:00Z',
      custom_content: {
        annotations: [
          {
            target: { selector: { type: 'html_tag', tag: 'cit', id: 'csv-1' } },
            body: {
              title: 'export.csv',
              source: {
                type: 'attachment',
                attachment: {
                  type: 'text/csv',
                  url: 'files/account/uploads/export.csv',
                  title: 'export.csv',
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
      screen.getByRole('button', { name: CitationsI18nKeys.MarkerAriaLabel }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );

    expect(mockOpenCanvas).not.toHaveBeenCalled();
    expect(onAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'files/account/uploads/export.csv' }),
      1,
    );
  });

  it('activating one occurrence of a repeated cit id opens one card and previews it exactly once with the group-identical annotation', async () => {
    const message: Message = {
      role: MessageRole.Assistant,
      content:
        'Alice did X<cit data-id="e1"></cit> Bob did X<cit data-id="e1"></cit>',
      timestamp: '2026-09-11T10:00:00Z',
      custom_content: {
        annotations: [
          {
            target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
            body: {
              title: 'report.pdf',
              selector: {
                type: 'pdf_bbox',
                page: 1,
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0,
              },
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/pdf',
                  url: 'https://example.com/report.pdf',
                },
              },
            },
          },
        ],
      },
    };

    render(
      <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
    );

    const markers = screen.getAllByRole('button', {
      name: CitationsI18nKeys.MarkerAriaLabel,
    });
    expect(markers).toHaveLength(2);

    await userEvent.click(markers[0]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );

    expect(mockOpenCanvas).toHaveBeenCalledOnce();
    /* `annotationToPdfCanvasContent` resolves the group via
       `groups.find((g) => g.annotations.includes(annotation))` (F9) — a
       cloned annotation would fail this lookup and `page` would be
       `undefined`. */
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/report.pdf',
        page: 1,
      }),
      expect.any(String),
    );
  });

  it('keeps two distinct cit ids independently openable when their annotations share quote text and source URL', async () => {
    const sharedQuote = 'Dinosaurs first appeared in the Triassic';
    const sharedUrl = 'https://example.com/report.pdf';
    const message: Message = {
      role: MessageRole.Assistant,
      content:
        'Claim one<cit data-id="e1"></cit> Claim two<cit data-id="e2"></cit>',
      timestamp: '2026-09-12T10:00:00Z',
      custom_content: {
        annotations: [
          {
            target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
            body: {
              title: 'report.pdf',
              quote: sharedQuote,
              source: {
                type: 'attachment',
                attachment: { type: 'application/pdf', url: sharedUrl },
              },
            },
          },
          {
            target: { selector: { type: 'html_tag', tag: 'cit', id: 'e2' } },
            body: {
              title: 'report.pdf',
              quote: sharedQuote,
              source: {
                type: 'attachment',
                attachment: { type: 'application/pdf', url: sharedUrl },
              },
            },
          },
        ],
      },
    };

    render(
      <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
    );

    const markers = screen.getAllByRole('button', {
      name: CitationsI18nKeys.MarkerAriaLabel,
    });
    expect(markers).toHaveLength(2);

    await userEvent.click(markers[0]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await userEvent.click(markers[1]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('activating repeated markers across two paragraphs opens one card each time', async () => {
    const message: Message = {
      role: MessageRole.Assistant,
      content:
        'First paragraph cites this<cit data-id="e1"></cit>.\n\nSecond paragraph cites it again<cit data-id="e1"></cit>.',
      timestamp: '2026-09-13T10:00:00Z',
      custom_content: {
        annotations: [
          {
            target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
            body: {
              title: 'report.pdf',
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/pdf',
                  url: 'https://example.com/report.pdf',
                },
              },
            },
          },
        ],
      },
    };

    render(
      <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
    );

    const markers = screen.getAllByRole('button', {
      name: CitationsI18nKeys.MarkerAriaLabel,
    });
    expect(markers).toHaveLength(2);

    await userEvent.click(markers[0]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await userEvent.click(markers[1]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('previews the annotation the card is showing after navigating with Next from a repeated marker', async () => {
    const message: Message = {
      role: MessageRole.Assistant,
      content:
        'Alice did X<cit data-id="e1"></cit> Bob did X<cit data-id="e1"></cit>',
      timestamp: '2026-09-14T10:00:00Z',
      custom_content: {
        annotations: [
          {
            index: 0,
            target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
            body: {
              title: 'report.pdf',
              selector: {
                type: 'pdf_bbox',
                page: 1,
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0,
              },
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/pdf',
                  url: 'https://example.com/report.pdf',
                },
              },
            },
          },
          {
            index: 1,
            target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
            body: {
              title: 'report.pdf',
              selector: {
                type: 'pdf_bbox',
                page: 2,
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0,
              },
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/pdf',
                  url: 'https://example.com/report.pdf',
                },
              },
            },
          },
        ],
      },
    };

    render(
      <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
    );

    const markers = screen.getAllByRole('button', {
      name: CitationsI18nKeys.MarkerAriaLabel,
    });
    await userEvent.click(markers[1]);
    await userEvent.click(
      screen.getByRole('button', { name: CitationsI18nKeys.PopupNextCitation }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );

    expect(mockOpenCanvas).toHaveBeenCalledOnce();
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/report.pdf',
        page: 2,
      }),
      expect.any(String),
    );
  });

  /*
   * Fixture trimmed from a user-confirmed reproduction of issue #8822: the
   * assistant response's `content`/`custom_content.annotations`, source URL
   * replaced with a test value, execution history/model state omitted.
   * Findings from that payload (recorded in task 4.1 of
   * `openspec/changes/fix-repeated-citation-popup-identity/tasks.md`):
   * source is a PDF (not the issue's original DOCX); `ff3390`/`7bba1b` each
   * occur twice in `content` against exactly one annotation each (no
   * `index`); `ff3390`'s annotation carries two `pdf_region` selectors. This
   * demonstrates the repeated-occurrence identity bug (F1) this change
   * fixes; it does not demonstrate an intra-set highlight-id collision (F6)
   * — each PDF group here has exactly one annotation, so
   * `annotationsToPdfHighlights` never gathers more than one entry.
   */
  it.each([0, 1, 2, 3])(
    'reproduces issue #8822: repeated PDF citation %i supports preview and download',
    async (markerIndex) => {
      const message: Message = {
        role: MessageRole.Assistant,
        content:
          '\n\r\n\rBased on the provided document, **David Reynolds** was an independent eye-witness to the incident. \n\nHere are the key details regarding his statement and involvement:\n* **Role:** He was a pedestrian located near the scene of the accident <cit data-id="ff3390"></cit>.\n* **Observations:** \n  * He reported hearing screeching tires and seeing a Honda vehicle spinning immediately after the initial impact <cit data-id="ff3390"></cit>.\n  * He noted that the Mustang involved had absolutely no opportunity to avoid the subsequent collision <cit data-id="7bba1b"></cit>.\n* **Conclusion:** He characterized the entire event as a rapid chain reaction <cit data-id="7bba1b"></cit>.',
        timestamp: '2026-09-16T07:21:28.670Z',
        custom_content: {
          annotations: [
            {
              target: {
                selector: { type: 'html_tag', tag: 'cit', id: 'ff3390' },
              },
              body: {
                title: 'max_artificial_claim.pdf',
                quote:
                  'David Reynolds, a pedestrian crossing nearby, reported, "I heard the screeching tires and turned to see the Honda spinning after the first impact.',
                selector: [
                  {
                    type: 'pdf_region',
                    page: 1,
                    bbox: { lt: [68.544, 603.504], wh: [455.94, 19.8] },
                  },
                  {
                    type: 'pdf_region',
                    page: 1,
                    bbox: { lt: [68.544, 614.592], wh: [299.268, 19.008] },
                  },
                ],
                source: {
                  type: 'attachment',
                  attachment: {
                    type: 'application/pdf',
                    url: 'files/test-bucket/uploads/max_artificial_claim.pdf',
                    title: 'max_artificial_claim.pdf',
                  },
                },
              },
            },
            {
              target: {
                selector: { type: 'html_tag', tag: 'cit', id: '7bba1b' },
              },
              body: {
                title: 'max_artificial_claim.pdf',
                quote:
                  'The Mustang didn’t have a chance to avoid the collision — it was like a chain reaction."',
                selector: [
                  {
                    type: 'pdf_region',
                    page: 1,
                    bbox: { lt: [68.544, 624.096], wh: [394.128, 19.8] },
                  },
                ],
                source: {
                  type: 'attachment',
                  attachment: {
                    type: 'application/pdf',
                    url: 'files/test-bucket/uploads/max_artificial_claim.pdf',
                    title: 'max_artificial_claim.pdf',
                  },
                },
              },
            },
          ],
        },
      };

      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);

      render(
        <ConversationMessageItem {...defaultProps} msg={message} index={1} />,
      );

      const markers = screen.getAllByRole('button', {
        name: CitationsI18nKeys.MarkerAriaLabel,
      });
      expect(markers).toHaveLength(4);

      const marker = markers[markerIndex];
      await userEvent.click(marker);
      expect(screen.getAllByRole('dialog')).toHaveLength(1);

      await userEvent.click(
        screen.getByRole('button', { name: BasicI18nKeys.Preview }),
      );
      expect(mockOpenCanvas).toHaveBeenCalledOnce();
      expect(screen.queryAllByRole('dialog')).toHaveLength(0);
      mockOpenCanvas.mockClear();
      await userEvent.click(marker);
      await userEvent.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.Download }),
      );
      expect(clickSpy).toHaveBeenCalledOnce();
      clickSpy.mockClear();

      clickSpy.mockRestore();
    },
  );
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
      screen.getByRole('button', { name: ButtonsI18nKeys.Copy }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.DownloadAsCsv }),
    ).toBeTruthy();
    expect(capturedLabels).toMatchObject({
      tableCopyLabel: ButtonsI18nKeys.Copy,
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

describe('ConversationMessageItem — application visualizers', () => {
  const ASSISTANT_WITH_ATTACHMENTS: Message = {
    role: MessageRole.Assistant,
    content: 'Here is the figure.',
    timestamp: '2024-01-01T00:00:02Z',
    custom_content: {
      attachments: [
        {
          title: 'figure.viz',
          type: 'application/x-my-viz',
          url: 'files/bucket/figure.viz',
        },
        {
          title: 'notes.pdf',
          type: 'application/pdf',
          url: 'files/bucket/notes.pdf',
        },
      ],
    },
  };

  const registryWith = (
    overrides?: Partial<ApplicationVisualizer>,
  ): ApplicationVisualizerRegistry => ({
    'app-1': {
      title: 'my-viz',
      url: 'https://viz.example.com',
      contentType: 'application/x-my-viz',
      height: 600,
      ...overrides,
    },
  });

  const renderItem = (props?: Record<string, unknown>) =>
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={ASSISTANT_WITH_ATTACHMENTS}
        index={1}
        effectiveDeploymentId="app-1"
        openedInCanvasLabel="Opened in Canvas"
        {...props}
      />,
    );

  it('renders the inline visualizer when the deployment matches an entry', () => {
    applicationVisualizersMock = registryWith();

    renderItem();

    expect(screen.getByText('my-viz')).toBeTruthy();
    expect(screen.getByTitle('my-viz')).toBeTruthy();
  });

  it('renders no inline visualizer when the registry is empty', () => {
    renderItem();

    expect(screen.queryByText('my-viz')).toBeNull();
  });

  it('renders no inline visualizer when the deployment id is absent from the registry', () => {
    applicationVisualizersMock = registryWith();

    renderItem({ effectiveDeploymentId: 'other-app' });

    expect(screen.queryByText('my-viz')).toBeNull();
  });

  it('keeps the unclaimed attachment in the tray and drops the claimed one', () => {
    applicationVisualizersMock = registryWith();

    renderItem();

    /* The tile splits the name — `DialFileName` renders the base name as the
     * element's text and title, with the extension alongside it. */
    expect(screen.getByTitle('notes')).toBeTruthy();
    expect(screen.queryByTitle('figure')).toBeNull();
  });

  it('claims every URL attachment when the entry declares no contentType', () => {
    applicationVisualizersMock = registryWith({ contentType: undefined });

    renderItem();

    expect(screen.queryByTitle('notes')).toBeNull();
    expect(screen.queryByTitle('figure')).toBeNull();
  });

  it('opens the canvas with the grouped content and its message-scoped key', async () => {
    applicationVisualizersMock = registryWith();

    renderItem();
    await userEvent.click(
      screen.getByRole('button', { name: 'attachmentCanvas.expandAppLabel' }),
    );

    expect(mockOpenCanvas).toHaveBeenCalledOnce();
    const [content, panelTitle, canvasKey] = mockOpenCanvas.mock.calls[0];
    expect(content).toMatchObject({
      type: AttachmentContentType.GroupedVisualizer,
      url: 'https://viz.example.com',
      visualizerName: 'my-viz',
    });
    expect(content.attachments).toHaveLength(1);
    expect(content.attachments[0].mimeType).toBe('application/x-my-viz');
    /* Absolute, not the host-relative path the same resolver hands same-origin
     * callers: a relative URL posted into the iframe would resolve against the
     * visualizer's own origin. */
    expect(content.attachments[0].url).toBe(
      'http://localhost:3000/api/v1/files/download?bucket=bucket&path=figure.viz',
    );
    expect(content.layout).toMatchObject({ themeId: 'dark', height: 600 });
    expect(panelTitle).toBe('my-viz');
    expect(canvasKey).toBe('1:grouped-visualizer');
  });

  it('replaces the inline frame with the opened-in-canvas placeholder', () => {
    applicationVisualizersMock = registryWith();

    renderItem({ selectedAttachmentKey: '1:grouped-visualizer' });

    expect(screen.getByText('Opened in Canvas')).toBeTruthy();
    expect(screen.queryByTitle('my-viz')).toBeNull();
  });
});

describe('ConversationMessageItem — application visualizer sizing and fallbacks', () => {
  const registry = (
    overrides?: Partial<ApplicationVisualizer>,
  ): ApplicationVisualizerRegistry => ({
    'app-1': {
      title: 'my-viz',
      url: 'https://viz.example.com',
      contentType: 'application/x-my-viz',
      height: 600,
      ...overrides,
    },
  });

  const renderWith = (
    attachments: { title: string; type: string; url: string }[],
    props?: Record<string, unknown>,
  ) =>
    render(
      <ConversationMessageItem
        {...defaultProps}
        msg={{
          role: MessageRole.Assistant,
          content: 'Here it is.',
          timestamp: '2024-01-01T00:00:02Z',
          custom_content: { attachments },
        }}
        index={1}
        effectiveDeploymentId="app-1"
        {...props}
      />,
    );

  it('uses mobileHeight on a mobile viewport', () => {
    isMobileMock = true;
    applicationVisualizersMock = registry({ mobileHeight: 320 });

    const { container } = renderWith([
      {
        title: 'figure.viz',
        type: 'application/x-my-viz',
        url: 'files/bucket/figure.viz',
      },
    ]);

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- asserting an inline pixel height on the unlabeled frame wrapper, which has no accessible role or text to query
    expect(container.querySelector('[style*="height: 320px"]')).toBeTruthy();
  });

  it('falls back to height on mobile when the entry declares no mobileHeight', () => {
    isMobileMock = true;
    applicationVisualizersMock = registry();

    const { container } = renderWith([
      {
        title: 'figure.viz',
        type: 'application/x-my-viz',
        url: 'files/bucket/figure.viz',
      },
    ]);

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- same unlabeled frame wrapper
    expect(container.querySelector('[style*="height: 600px"]')).toBeTruthy();
  });

  it('keeps a claimed attachment in the tray when no URL can be resolved for it', () => {
    applicationVisualizersMock = registry();

    renderWith([
      {
        title: 'resolvable.viz',
        type: 'application/x-my-viz',
        url: 'files/bucket/resolvable.viz',
      },
      {
        title: 'unresolvable.viz',
        type: 'application/x-my-viz',
        url: 'attachments/unresolvable.viz',
      },
    ]);

    /* The inline surface still renders for the attachment that did resolve,
     * and the one that did not falls back to an ordinary tile rather than
     * disappearing from the message. */
    expect(screen.getByTitle('my-viz')).toBeTruthy();
    expect(screen.getByTitle('unresolvable')).toBeTruthy();
    expect(screen.queryByTitle('resolvable')).toBeNull();
  });

  it('renders no inline surface when nothing claimed resolves to a URL', () => {
    applicationVisualizersMock = registry();

    renderWith([
      {
        title: 'unresolvable.viz',
        type: 'application/x-my-viz',
        url: 'attachments/unresolvable.viz',
      },
    ]);

    expect(screen.queryByText('my-viz')).toBeNull();
    expect(screen.getByTitle('unresolvable')).toBeTruthy();
  });
});
