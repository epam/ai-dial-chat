import type { DisplayAttachment, Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ConversationSourcesPanel from '../ConversationSourcesPanel';

const mockHandleClose = vi.fn();
const mockUseSourcesSidebar = vi.fn();

vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => mockUseSourcesSidebar(),
}));

vi.mock('@epam/ai-dial-sidebar', () => ({
  SidebarPanel: ({
    children,
    ariaLabel,
    onClose,
    leftActions,
    rightActions,
  }: {
    children: ReactNode;
    ariaLabel: string;
    onClose: () => void;
    leftActions?: ReactNode;
    rightActions?: ReactNode;
  }) => (
    <aside aria-label={ariaLabel}>
      {leftActions}
      {rightActions}
      <button aria-label="Close" onClick={onClose} />
      <div>{children}</div>
    </aside>
  ),
  SearchInput: ({
    placeholder,
    value,
    onChange,
  }: {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  SidebarSide: { Right: 'right', Left: 'left' },
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  DialGhostIconButton: ({
    'aria-label': ariaLabel,
    disabled,
  }: {
    'aria-label': string;
    disabled?: boolean;
  }) => <button type="button" aria-label={ariaLabel} disabled={disabled} />,
}));

vi.mock('@epam/ai-dial-conversation-input', () => ({
  AttachmentCard: ({ attachment }: { attachment: DisplayAttachment }) => (
    <div>{attachment.name}</div>
  ),
}));

const makeUserMessage = (attachmentTitle: string): Message => ({
  id: attachmentTitle,
  role: MessageRole.User,
  content: 'hi',
  timestamp: '',
  custom_content: {
    attachments: [{ title: attachmentTitle, type: 'application/pdf' }],
  },
});

const makeAssistantMessage = (attachmentTitle: string): Message => ({
  id: attachmentTitle,
  role: MessageRole.Assistant,
  content: 'ok',
  timestamp: '',
  custom_content: {
    attachments: [{ title: attachmentTitle, type: 'text/csv' }],
  },
});

const renderPanel = (messages: Message[] = []) => {
  mockUseSourcesSidebar.mockReturnValue({
    handleClose: mockHandleClose,
    isOpen: true,
    messages,
  });

  return render(<ConversationSourcesPanel />);
};

describe('ConversationSourcesPanel', () => {
  it('derives uploaded files from user messages', () => {
    renderPanel([makeUserMessage('upload.pdf')]);
    expect(screen.getByText('upload.pdf')).toBeTruthy();
  });

  it('derives generated files from assistant messages', () => {
    renderPanel([makeAssistantMessage('result.csv')]);
    expect(screen.getByText('result.csv')).toBeTruthy();
  });

  it('close button calls useSourcesSidebar().handleClose via context', async () => {
    mockHandleClose.mockClear();
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockHandleClose).toHaveBeenCalledOnce();
  });

  it('renders the panel empty state when the conversation has no files', () => {
    renderPanel();

    expect(screen.getByText('sidebar.sources.noData')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'sidebar.sources.search' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'sidebar.sources.downloadAll' }),
    ).toBeNull();
  });

  it('renders uploaded and generated sections in order', () => {
    renderPanel([
      makeUserMessage('upload.pdf'),
      makeAssistantMessage('result.csv'),
    ]);
    const headings = screen.getAllByRole('heading');
    const texts = headings.map((h) => h.textContent);
    expect(texts).toContain('sidebar.sources.sections.uploadedFiles');
    expect(texts).toContain('sidebar.sources.sections.generatedFiles');
    const uploadedIdx = texts.indexOf('sidebar.sources.sections.uploadedFiles');
    const generatedIdx = texts.indexOf(
      'sidebar.sources.sections.generatedFiles',
    );
    expect(uploadedIdx).toBeLessThan(generatedIdx);
  });
});

describe('ConversationSourcesPanel — search', () => {
  const renderOpenPanel = (messages: Message[] = []) => {
    mockUseSourcesSidebar.mockReturnValue({
      handleClose: mockHandleClose,
      isOpen: true,
      messages,
    });
    return render(<ConversationSourcesPanel />);
  };

  // 5.1 — typing a partial name filters both sections
  it('typing a partial name filters both uploaded and generated sections', async () => {
    const user = userEvent.setup();
    renderOpenPanel([
      makeUserMessage('Annual Report.pdf'),
      makeUserMessage('Budget.xlsx'),
      makeAssistantMessage('Summary Report.csv'),
      makeAssistantMessage('Chart.png'),
    ]);

    await user.type(screen.getByRole('searchbox'), 'report');

    expect(screen.getByText('Annual Report.pdf')).toBeTruthy();
    expect(screen.getByText('Summary Report.csv')).toBeTruthy();
    expect(screen.queryByText('Budget.xlsx')).toBeNull();
    expect(screen.queryByText('Chart.png')).toBeNull();
  });

  // 5.2 — query matching nothing shows "No results found" and no file sections
  it('shows "No results found" when query matches no attachments', async () => {
    const user = userEvent.setup();
    renderOpenPanel([
      makeUserMessage('upload.pdf'),
      makeAssistantMessage('result.csv'),
    ]);

    await user.type(screen.getByRole('searchbox'), 'zzznomatch');

    expect(screen.getByText('sidebar.sources.noResults')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  // 5.3 — clearing the query restores all attachments
  it('clearing the query restores all attachments', async () => {
    const user = userEvent.setup();
    renderOpenPanel([
      makeUserMessage('upload.pdf'),
      makeAssistantMessage('result.csv'),
    ]);

    const input = screen.getByRole('searchbox');
    await user.type(input, 'zzznomatch');
    expect(screen.getByText('sidebar.sources.noResults')).toBeTruthy();

    await user.clear(input);
    expect(screen.getByText('upload.pdf')).toBeTruthy();
    expect(screen.getByText('result.csv')).toBeTruthy();
    expect(screen.queryByText('sidebar.sources.noResults')).toBeNull();
  });

  // 5.4 — closing the panel resets the search input
  //
  // Strategy: render open with a query, then switch to isOpen=false inside
  // act() so the useLayoutEffect that calls setSearchQuery('') is fully
  // committed before the assertion. We assert on the closed state (empty input)
  // rather than re-opening, which avoids the React-18 batching issue that
  // occurs when two synchronous rerenders race with a layout effect.
  it('resets search query when panel transitions to closed', async () => {
    const messages = [
      makeUserMessage('upload.pdf'),
      makeUserMessage('other.pdf'),
    ];
    const user = userEvent.setup();

    mockUseSourcesSidebar.mockReturnValue({
      handleClose: mockHandleClose,
      isOpen: true,
      messages,
    });
    const { rerender } = render(<ConversationSourcesPanel />);

    // Type a query that hides other.pdf
    await user.type(screen.getByRole('searchbox'), 'upload');
    expect(screen.queryByText('other.pdf')).toBeNull();

    // Close the panel inside act() — flushes the useLayoutEffect synchronously
    await act(async () => {
      mockUseSourcesSidebar.mockReturnValue({
        handleClose: mockHandleClose,
        isOpen: false,
        messages,
      });
      rerender(<ConversationSourcesPanel />);
    });

    // The layout effect fired during the act() and reset searchQuery to ''.
    // On the next open, both files will be visible — verified by re-opening
    // in a fresh act() so the render commits cleanly.
    await act(async () => {
      mockUseSourcesSidebar.mockReturnValue({
        handleClose: mockHandleClose,
        isOpen: true,
        messages,
      });
      rerender(<ConversationSourcesPanel />);
    });

    expect(screen.getByText('upload.pdf')).toBeTruthy();
    expect(screen.getByText('other.pdf')).toBeTruthy();
  });
});
