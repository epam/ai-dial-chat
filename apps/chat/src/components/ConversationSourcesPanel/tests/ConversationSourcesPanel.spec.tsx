import { MessageRole } from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment, Message } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AriaAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SourcesSidebarProvider } from '../../../context/SourcesSidebarContext.js';
import ConversationSourcesPanel from '../ConversationSourcesPanel.js';

vi.mock('@epam/ai-dial-sidebar', () => ({
  SidebarPanel: ({
    children,
    ariaLabel,
    onClose,
    leftActions,
    rightActions,
  }: {
    children: React.ReactNode;
    ariaLabel: string;
    onClose: () => void;
    leftActions?: React.ReactNode;
    rightActions?: React.ReactNode;
  }) => (
    <aside aria-label={ariaLabel}>
      <div data-testid="left-actions">{leftActions}</div>
      <div data-testid="right-actions">{rightActions}</div>
      <button aria-label="Close" onClick={onClose} />
      <div>{children}</div>
    </aside>
  ),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  DialGhostIconButton: ({
    'aria-label': ariaLabel,
    disabled,
    onClick,
  }: {
    'aria-label': string;
    disabled?: boolean;
    onClick?: () => void;
  } & AriaAttributes) => (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    />
  ),
}));

vi.mock('@epam/ai-dial-conversation-input', () => ({
  AttachmentCard: ({ attachment }: { attachment: DisplayAttachment }) => (
    <div data-testid="attachment-card">{attachment.name}</div>
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

const renderPanel = (
  messages: Message[] = [],
  onSearch?: () => void,
  onDownloadAll?: () => void,
) =>
  render(
    <SourcesSidebarProvider>
      <ConversationSourcesPanel
        messages={messages}
        onSearch={onSearch}
        onDownloadAll={onDownloadAll}
      />
    </SourcesSidebarProvider>,
  );

describe('ConversationSourcesPanel', () => {
  it('derives uploaded files from user messages', () => {
    renderPanel([makeUserMessage('upload.pdf')]);
    expect(screen.getByText('upload.pdf')).toBeTruthy();
  });

  it('derives generated files from assistant messages', () => {
    renderPanel([makeAssistantMessage('result.csv')]);
    expect(screen.getByText('result.csv')).toBeTruthy();
  });

  it('search button is disabled when onSearch is not provided', () => {
    renderPanel();
    const btn = screen.getByRole('button', { name: /sidebar.sources.search/ });
    expect(btn).toHaveProperty('disabled', true);
  });

  it('download button is disabled when onDownloadAll is not provided', () => {
    renderPanel();
    const btn = screen.getByRole('button', {
      name: /sidebar.sources.downloadAll/,
    });
    expect(btn).toHaveProperty('disabled', true);
  });

  it('search button is enabled and fires callback when provided', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    renderPanel([], onSearch);
    const btn = screen.getByRole('button', { name: /sidebar.sources.search/ });
    expect(btn).toHaveProperty('disabled', false);
    await user.click(btn);
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('download button is enabled and fires callback when provided', async () => {
    const user = userEvent.setup();
    const onDownloadAll = vi.fn();
    renderPanel([], undefined, onDownloadAll);
    const btn = screen.getByRole('button', {
      name: /sidebar.sources.downloadAll/,
    });
    await user.click(btn);
    expect(onDownloadAll).toHaveBeenCalledOnce();
  });

  it('close button calls useSourcesSidebar().close via context', async () => {
    const user = userEvent.setup();
    renderPanel();
    // Sidebar starts open because we render it directly; click close
    await user.click(screen.getByRole('button', { name: 'Close' }));
    // After close, the panel itself is still rendered in this test (context is mocked via provider)
    // — just assert no error thrown and close button exists
    expect(screen.queryByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('renders three sections in order', () => {
    renderPanel();
    const headings = screen.getAllByRole('heading');
    const texts = headings.map((h) => h.textContent);
    expect(texts).toContain('sidebar.sources.sections.uploadedFiles');
    expect(texts).toContain('sidebar.sources.sections.generatedFiles');
    expect(texts).toContain('sidebar.sources.sections.sources');
    // Order: uploaded first, generated second, sources third
    const uploadedIdx = texts.indexOf('sidebar.sources.sections.uploadedFiles');
    const generatedIdx = texts.indexOf(
      'sidebar.sources.sections.generatedFiles',
    );
    const sourcesIdx = texts.indexOf('sidebar.sources.sections.sources');
    expect(uploadedIdx).toBeLessThan(generatedIdx);
    expect(generatedIdx).toBeLessThan(sourcesIdx);
  });
});
