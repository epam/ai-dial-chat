import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationSourcesPanelContainer from '../ConversationSourcesPanel';

const mockDownloadAttachment = vi.fn();
const mockHandleAttachmentClick = vi.fn();
const mockHandleClose = vi.fn();

let mockUploaded: DisplayAttachment[] = [];
let mockGenerated: DisplayAttachment[] = [];

vi.mock('@epam/ai-dial-source-panel', () => ({
  ConversationSourcesPanel: ({
    onDownloadAll,
  }: {
    onDownloadAll?: () => void;
  }) => (
    <button
      type="button"
      aria-label="Download all"
      disabled={!onDownloadAll}
      onClick={onDownloadAll}
    />
  ),
}));

vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({
    handleClose: mockHandleClose,
    isOpen: true,
    messages: [],
  }),
}));

vi.mock('../../../hooks/attachment/useAttachmentAction', () => ({
  downloadAttachment: (attachment: DisplayAttachment) =>
    mockDownloadAttachment(attachment),
  useAttachmentAction: () => ({
    handleAttachmentClick: mockHandleAttachmentClick,
  }),
}));

vi.mock('../../../hooks/attachment/useOpenAttachmentCanvas', () => ({
  useOpenAttachmentCanvas: () => ({
    openAttachmentCanvas: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));

vi.mock('../../../hooks/conversation-sources/useConversationSources', () => ({
  useConversationSources: () => ({
    uploaded: mockUploaded,
    generated: mockGenerated,
    sources: [],
  }),
}));

vi.mock('../../../hooks/use-viewport-width', () => ({
  default: () => 1200,
}));

vi.mock('../../../hooks/useLocalStorage', () => ({
  default: () => [360, vi.fn()],
}));

vi.mock('../../../utils/dial-file', () => ({
  isDialFileId: (url: string) => url.startsWith('files/'),
}));

const makeAttachment = (
  name: string,
  overrides?: Partial<DisplayAttachment>,
): DisplayAttachment => ({
  id: name,
  name,
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('ConversationSourcesPanelContainer — download all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUploaded = [];
    mockGenerated = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the download-all button disabled when there is no downloadable attachment', () => {
    mockUploaded = [
      makeAttachment('reference.pdf', { url: 'https://external.com/f.pdf' }),
    ];
    render(<ConversationSourcesPanelContainer />);

    expect(
      (
        screen.getByRole('button', {
          name: 'Download all',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('renders the download-all button enabled when a downloadable attachment is present', () => {
    mockUploaded = [
      makeAttachment('upload.pdf', { url: 'files/bucket/f.pdf' }),
    ];
    render(<ConversationSourcesPanelContainer />);

    expect(
      (
        screen.getByRole('button', {
          name: 'Download all',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('downloads every downloadable attachment across uploaded and generated, skipping non-downloadable ones', async () => {
    const uploadedFile = makeAttachment('upload.pdf', {
      url: 'files/bucket/upload.pdf',
    });
    const generatedFile = makeAttachment('result.csv', {
      url: 'files/bucket/result.csv',
    });
    const reference = makeAttachment('reference.pdf', {
      url: 'https://external.com/reference.pdf',
    });
    mockUploaded = [uploadedFile, reference];
    mockGenerated = [generatedFile];

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    render(<ConversationSourcesPanelContainer />);

    await user.click(screen.getByRole('button', { name: 'Download all' }));
    vi.runAllTimers();

    expect(mockDownloadAttachment).toHaveBeenCalledTimes(2);
    expect(mockDownloadAttachment).toHaveBeenCalledWith(uploadedFile);
    expect(mockDownloadAttachment).toHaveBeenCalledWith(generatedFile);
  });
});
