import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { QuotationSource } from '../../../models/quotation-source';
import type { ConversationSourcesPanelLabels } from '../ConversationSourcesPanel';
import ConversationSourcesPanel from '../ConversationSourcesPanel';

vi.mock('@epam/ai-dial-sidebar', () => ({
  PanelEmpty: ({ label }: { label: string }) => <div>{label}</div>,
  PanelNoResults: ({ label }: { label: string }) => <div>{label}</div>,
  SidebarOrientation: { Left: 'left', Right: 'right' },
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
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24, SM: 16 },
  ElementSize: { Small: 'small' },
  mergeClasses: (...classes: (string | undefined)[]) =>
    classes.filter(Boolean).join(' '),
  GhostIconButton: ({
    'aria-label': ariaLabel,
    disabled,
    onClick,
  }: {
    'aria-label': string;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    />
  ),
  DialEllipsisTooltip: ({ text }: { text: ReactNode }) => <span>{text}</span>,
  Highlight: ({ text }: { text: string }) => <span>{text}</span>,
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
      <button type="button" aria-label={attachment.name} onClick={onClick}>
        {attachment.name}
      </button>
    ) : (
      <div>{attachment.name}</div>
    ),
}));

const LABELS: ConversationSourcesPanelLabels = {
  ariaLabel: 'Sources panel',
  closeLabel: 'Close',
  searchPlaceholder: 'Search',
  searchClearLabel: 'Clear search',
  emptyLabel: 'Empty',
  noResultsLabel: 'No results',
  downloadAllLabel: 'Download all',
  uploadedSectionTitle: 'Uploaded files',
  generatedSectionTitle: 'Generated files',
  sourcesSectionTitle: 'Sources',
  copySourceLabel: 'Copy',
  attachmentClickLabel: 'Download',
};

const makeAttachment = (name: string): DisplayAttachment => ({
  id: name,
  name,
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
});

const makeSource = (
  url: string,
  title: string,
  quote?: string,
): QuotationSource => ({
  url,
  title,
  contentType: 'application/pdf',
  quote,
});

const renderPanel = ({
  isOpen = true,
  uploaded = [] as DisplayAttachment[],
  generated = [] as DisplayAttachment[],
  sources = [] as QuotationSource[],
  onAttachmentClick = vi.fn(),
  onClose = vi.fn(),
  onDownloadAll = undefined as (() => void) | undefined,
} = {}) =>
  render(
    <ConversationSourcesPanel
      isOpen={isOpen}
      onClose={onClose}
      uploaded={uploaded}
      generated={generated}
      sources={sources}
      onAttachmentClick={onAttachmentClick}
      onDownloadAll={onDownloadAll}
      isMobile={false}
      labels={LABELS}
    />,
  );

describe('ConversationSourcesPanel', () => {
  it('renders uploaded attachments', () => {
    renderPanel({ uploaded: [makeAttachment('upload.pdf')] });
    expect(screen.getByText('upload.pdf')).toBeTruthy();
  });

  it('renders generated attachments', () => {
    renderPanel({ generated: [makeAttachment('result.csv')] });
    expect(screen.getByText('result.csv')).toBeTruthy();
  });

  it('close button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onClose });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders empty state when no data', () => {
    renderPanel();
    expect(screen.getByText('Empty')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download all' })).toBeNull();
  });

  it('renders uploaded and generated sections in order', () => {
    renderPanel({
      uploaded: [makeAttachment('upload.pdf')],
      generated: [makeAttachment('result.csv')],
    });
    const headings = screen.getAllByRole('heading');
    const texts = headings.map((h) => h.textContent);
    expect(texts).toContain('Uploaded files');
    expect(texts).toContain('Generated files');
    expect(texts.indexOf('Uploaded files')).toBeLessThan(
      texts.indexOf('Generated files'),
    );
  });

  it('renders sources section', () => {
    renderPanel({ sources: [makeSource('https://example.com', 'Example')] });
    expect(screen.getByText('Example')).toBeTruthy();
  });

  it('renders the download-all button disabled when onDownloadAll is omitted', () => {
    renderPanel({ uploaded: [makeAttachment('upload.pdf')] });
    expect(
      (
        screen.getByRole('button', {
          name: 'Download all',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('renders the download-all button enabled and wired to onDownloadAll', async () => {
    const user = userEvent.setup();
    const onDownloadAll = vi.fn();
    renderPanel({
      uploaded: [makeAttachment('upload.pdf')],
      onDownloadAll,
    });

    const button = screen.getByRole('button', {
      name: 'Download all',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    await user.click(button);
    expect(onDownloadAll).toHaveBeenCalledOnce();
  });
});

describe('ConversationSourcesPanel — search', () => {
  it('typing a partial name filters uploaded and generated sections', async () => {
    const user = userEvent.setup();
    renderPanel({
      uploaded: [
        makeAttachment('Annual Report.pdf'),
        makeAttachment('Budget.xlsx'),
      ],
      generated: [
        makeAttachment('Summary Report.csv'),
        makeAttachment('Chart.png'),
      ],
    });

    await user.type(screen.getByRole('searchbox'), 'report');

    expect(screen.getByText('Annual Report.pdf')).toBeTruthy();
    expect(screen.getByText('Summary Report.csv')).toBeTruthy();
    expect(screen.queryByText('Budget.xlsx')).toBeNull();
    expect(screen.queryByText('Chart.png')).toBeNull();
  });

  it('shows no-results state when query matches nothing', async () => {
    const user = userEvent.setup();
    renderPanel({
      uploaded: [makeAttachment('upload.pdf')],
      generated: [makeAttachment('result.csv')],
    });

    await user.type(screen.getByRole('searchbox'), 'zzznomatch');

    expect(screen.getAllByText('No results')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('clearing the query restores all attachments', async () => {
    const user = userEvent.setup();
    renderPanel({
      uploaded: [makeAttachment('upload.pdf')],
      generated: [makeAttachment('result.csv')],
    });

    const input = screen.getByRole('searchbox');
    await user.type(input, 'zzznomatch');
    expect(screen.getAllByText('No results')).toBeTruthy();

    await user.clear(input);
    expect(screen.getByText('upload.pdf')).toBeTruthy();
    expect(screen.getByText('result.csv')).toBeTruthy();
    expect(screen.queryByText('No results')).toBeNull();
  });

  it('filters sources by title, url, and quote', async () => {
    const user = userEvent.setup();
    renderPanel({
      sources: [
        makeSource('https://match.com', 'Keep me', 'relevant quote'),
        makeSource('https://other.com', 'Hide me'),
      ],
    });

    await user.type(screen.getByRole('searchbox'), 'keep');

    expect(screen.getByRole('link', { name: /keep me/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /hide me/i })).toBeNull();
  });
});
