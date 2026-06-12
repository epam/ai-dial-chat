import type { DisplayAttachment, Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BasicI18nKeys } from '../../../constants/translation-keys';
import ConversationSourcesPanel from '../ConversationSourcesPanel';

const mockHandleAttachmentClick = vi.fn();
vi.mock('../../../hooks/attachment/useAttachmentAction', () => ({
  useAttachmentAction: () => ({
    handleAttachmentClick: mockHandleAttachmentClick,
  }),
}));

const mockHandleClose = vi.fn();
const mockUseSourcesSidebar = vi.fn();

vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => mockUseSourcesSidebar(),
}));

vi.mock('@epam/ai-dial-sidebar', () => ({
  PanelEmpty: ({ label }: { label: string }) => <div>{label}</div>,
  PanelNoResults: ({ label }: { label: string }) => <div>{label}</div>,
  SidebarPanel: ({
    children,
    isOpen,
    ariaLabel,
    onClose,
    leftActions,
    rightActions,
  }: {
    children: ReactNode;
    isOpen?: boolean;
    ariaLabel: string;
    onClose: () => void;
    leftActions?: ReactNode;
    rightActions?: ReactNode;
  }) => (
    <aside aria-label={ariaLabel}>
      {leftActions}
      {rightActions}
      <button aria-label="Close" onClick={onClose} />
      {isOpen ? <div>{children}</div> : null}
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
  AttachmentCard: ({
    attachment,
    onClick,
  }: {
    attachment: DisplayAttachment;
    onClick?: () => void;
  }) =>
    onClick ? (
      <button type="button" data-testid="attachment-card" onClick={onClick}>
        {attachment.name}
      </button>
    ) : (
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

    expect(screen.getByText(BasicI18nKeys.Empty)).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(
      screen.queryByRole('button', { name: BasicI18nKeys.SearchPlaceholder }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'sidebar.sources.downloadAll' }),
    ).toBeNull();
  });

  it('passes onAttachmentClick to both file sections', () => {
    renderPanel([
      makeUserMessage('upload.pdf'),
      makeAssistantMessage('result.csv'),
    ]);
    const cards = screen.getAllByTestId('attachment-card');
    expect(cards).toHaveLength(2);
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

    expect(screen.getByText(BasicI18nKeys.NoResults)).toBeTruthy();
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
    expect(screen.getByText(BasicI18nKeys.NoResults)).toBeTruthy();

    await user.clear(input);
    expect(screen.getByText('upload.pdf')).toBeTruthy();
    expect(screen.getByText('result.csv')).toBeTruthy();
    expect(screen.queryByText(BasicI18nKeys.NoResults)).toBeNull();
  });

  // 5.4 — closing/opening panel resets the search input
  //
  // This spec uses a mocked hook instead of the real context provider; because
  // the component is memoized, `rerender` won't reflect mocked context changes.
  // We verify reset behavior through an unmount/remount cycle instead.
  it('resets search query after panel remount', async () => {
    const messages = [
      makeUserMessage('upload.pdf'),
      makeUserMessage('other.pdf'),
    ];
    const user = userEvent.setup();

    const { unmount } = renderOpenPanel(messages);

    // Type a query that hides other.pdf
    await user.type(screen.getByRole('searchbox'), 'upload');
    expect(screen.queryByText('other.pdf')).toBeNull();

    unmount();
    renderOpenPanel(messages);

    expect(screen.getByText('upload.pdf')).toBeTruthy();
    expect(screen.getByText('other.pdf')).toBeTruthy();
  });
});
